import { NextResponse } from 'next/server';
import { createPublicClient, http, fallback, isAddress } from 'viem';
import { mainnet } from 'viem/chains';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function scoreFromHeuristics(params: {
  isValidAddress: boolean;
  isContract: boolean | null;
  balanceEth: number | null;
  txCount: number | null;
}) {
  const { isValidAddress, isContract, balanceEth, txCount } = params;

  let score = 40;

  score += isValidAddress ? 10 : -30;

  if (isContract === true) score += -10;
  else if (isContract === false) score += +8;

  if (typeof balanceEth === 'number') {
    if (balanceEth >= 10) score += 18;
    else if (balanceEth >= 1) score += 12;
    else if (balanceEth >= 0.1) score += 6;
    else if (balanceEth >= 0.01) score += 2;
  }

  if (typeof txCount === 'number') {
    if (txCount >= 500) score += 22;
    else if (txCount >= 100) score += 16;
    else if (txCount >= 20) score += 10;
    else if (txCount >= 5) score += 6;
    else if (txCount >= 1) score += 2;
  }

  return clamp(score, 0, 100);
}

// ✅ RPCを複数にして自動フォールバック
const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http('https://ethereum.publicnode.com'),
    http('https://rpc.ankr.com/eth'),
    http('https://eth.llamarpc.com'),
    http('https://cloudflare-eth.com'),
  ]),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address: string | undefined = body?.address;

  const isValid = !!address && isAddress(address);

  // 未接続でも PoC は動かす
  if (!isValid) {
    const score = scoreFromHeuristics({
      isValidAddress: false,
      isContract: null,
      balanceEth: null,
      txCount: null,
    });

    return NextResponse.json({
      ok: true,
      chain: { id: mainnet.id, name: mainnet.name },
      address: address ?? null,
      score,
      features: {
        isValidAddress: false,
        isContract: null,
        balanceEth: null,
        txCount: null,
      },
      rpcOk: false,
      rpcError: 'invalid_or_missing_address',
      kernel: { version: 'trust-kernel-poc-v1', method: 'heuristic+onchain(fallback)' },
      ts: new Date().toISOString(),
    });
  }

  // ✅ RPCが落ちても 500 にしない（PoCは止めない）
  let isContract: boolean | null = null;
  let balanceEth: number | null = null;
  let txCount: number | null = null;
  let rpcOk = false;
  let rpcError: string | null = null;

  try {
    const [balanceWei, tx, code] = await Promise.all([
      client.getBalance({ address }),
      client.getTransactionCount({ address }),
      client.getBytecode({ address }),
    ]);

    isContract = !!code && code !== '0x';
    balanceEth = Number(balanceWei) / 1e18;
    txCount = tx;

    rpcOk = true;
  } catch (e: any) {
    rpcOk = false;
    rpcError = e?.shortMessage ?? e?.message ?? 'rpc_error';
  }

  const score = scoreFromHeuristics({
    isValidAddress: true,
    isContract,
    balanceEth,
    txCount,
  });

  return NextResponse.json({
    ok: true,
    chain: { id: mainnet.id, name: mainnet.name },
    address,
    score,
    features: {
      isValidAddress: true,
      isContract,
      balanceEth: typeof balanceEth === 'number' ? Number(balanceEth.toFixed(6)) : null,
      txCount,
    },
    rpcOk,
    rpcError,
    kernel: { version: 'trust-kernel-poc-v1', method: 'heuristic+onchain(fallback)' },
    ts: new Date().toISOString(),
  });
}
