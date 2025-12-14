import { NextResponse } from 'next/server';
import { createPublicClient, http, isAddress, type Address } from 'viem';
import { mainnet } from 'viem/chains';

const FALLBACK_RPCS = [
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashSeedFromAddress(addr: string) {
  let x = 0;
  for (let i = 0; i < addr.length; i++) x = (x * 31 + addr.charCodeAt(i)) >>> 0;
  return x >>> 0;
}

function pseudo01(seed: number) {
  let x = seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return (x % 10_000) / 10_000;
}

async function getClient() {
  for (const url of FALLBACK_RPCS) {
    try {
      const client = createPublicClient({ chain: mainnet, transport: http(url) });
      await client.getBlockNumber(); // 疎通
      return { client, rpcUrl: url };
    } catch {}
  }
  return { client: null as any, rpcUrl: null as string | null };
}

/**
 * 擬似 wallet age（無料で可能な範囲）
 * - nonce>0 の場合：近似で「古め」に寄せる（精密なfirstTx探索は重いのでPoCはここで止める）
 * - nonce=0 の場合：若め（ただし即死しない）
 * - seedで決定的に揺らす
 */
function estimateWalletAgeDays(seed: number, txCount: number | null, balanceEth: number | null) {
  const jitter = pseudo01(seed ^ 0x9e3779b9); // 0..1
  if (txCount == null) return 30 + Math.round(jitter * 90); // 30..120（fallback）

  if (txCount === 0) {
    // 受け取るだけのウォレットもあるので、balanceが少しでもあれば若すぎにしない
    const base = balanceEth && balanceEth > 0 ? 60 : 25;
    return base + Math.round(jitter * 60); // 25..85 or 60..120
  }

  // txCountがある程度あるほど “年齢っぽい” を増やす（擬似）
  const scaled = clamp(Math.log10(txCount + 1) / Math.log10(300 + 1), 0, 1); // 0..1
  return 90 + Math.round(scaled * 900) + Math.round(jitter * 60); // 90..~1050日
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = (body?.address ?? null) as string | null;

  const valid = address ? isAddress(address) : false;

  const seed = hashSeedFromAddress(address ?? '0x0');

  // onchain
  let rpcOk = false;
  let rpcError: string | null = null;
  let rpcUrl: string | null = null;

  let balanceEth: number | null = null;
  let txCount: number | null = null;
  let isContract: boolean | null = null;

  if (valid && address) {
    try {
      const { client, rpcUrl: used } = await getClient();
      rpcUrl = used;

      if (client) {
        const addr = address as Address;
        const [bal, nonce, code] = await Promise.all([
          client.getBalance({ address: addr }),
          client.getTransactionCount({ address: addr }),
          client.getBytecode({ address: addr }),
        ]);

        rpcOk = true;
        balanceEth = Number(bal) / 1e18;
        txCount = nonce;
        isContract = !!code && code !== '0x';
      } else {
        rpcError = 'No RPC available';
      }
    } catch (e: any) {
      rpcError = e?.message ?? 'RPC error';
    }
  }

  // wallet age（擬似＋オンチェーン由来のtxCount/balanceを使う）
  const walletAgeDays = estimateWalletAgeDays(seed, txCount, balanceEth);

  // ---- “それっぽい”スコアリング（普通のEOAが60-80に寄りやすい） ----
  // スコアの土台：EOA前提で60近辺を中心に
  const base = 62 + Math.round((pseudo01(seed) - 0.5) * 10); // 57..67

  // features -> 0..1
  const f_activity = txCount == null ? 0.55 : clamp(Math.log10(txCount + 1) / Math.log10(200 + 1), 0, 1); // 0..1
  const f_balance = balanceEth == null ? 0.45 : clamp(Math.log10(balanceEth + 1e-6 + 1) / Math.log10(2 + 1), 0, 1); // 0..1（~2ETHで1に近い）
  const f_age = clamp(walletAgeDays / 365, 0, 3) / 3; // 0..1（3年以上は1）
  const contractPenalty = isContract === true ? 1 : 0;

  // weights（見せる用）
  const weights = {
    base: 0.0,          // baseは別加算（説明しやすい）
    walletAge: 14,      // 最大+14
    activity: 12,       // 最大+12
    balance: 10,        // 最大+10
    stability: 6,       // 最大+6（seed由来）
    contractPenalty: -10, // コントラクトなら最大-10
    invalidPenalty: -45,  // 無効アドレスは大きく減点
  };

  const stability = 0.55 + pseudo01(seed ^ 0xA5A5A5A5) * 0.45; // 0.55..1.0

  let score =
    base +
    Math.round(weights.walletAge * f_age) +
    Math.round(weights.activity * f_activity) +
    Math.round(weights.balance * f_balance) +
    Math.round(weights.stability * stability) +
    (contractPenalty ? weights.contractPenalty : 0);

  if (!valid) score += weights.invalidPenalty;

  score = clamp(score, 0, 100);

  return NextResponse.json({
    ok: true,
    address: address ?? null,
    score,
    confidence: rpcOk ? 0.9 : 0.7,
    weights,
    features: {
      isValidAddress: valid,
      rpcOk,
      rpcUrl,
      balanceEth,
      txCount,
      isContract,
      walletAgeDays,
    },
    ts: new Date().toISOString(),
    rpcError,
  });
}
