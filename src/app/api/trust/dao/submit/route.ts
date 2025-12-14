import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

function sha256Hex(input: string) {
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

function randomHex(len = 64) {
  const chars = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

type DaoResult = {
  approved: boolean;
  txHash: string;
  yes: number;
  no: number;
  quorum: number;
};

type LedgerEntryCore = {
  kind: 'trust_kernel_v1';
  ledgerId: string;
  height: number;
  prevHash: string | null;
  address: string | null;
  score: number;
  daoResult: DaoResult;
  createdAt: string;
};

type LedgerEntry = LedgerEntryCore & { hash: string };

declare global {
  // eslint-disable-next-line no-var
  var __TRUST_LEDGER__: LedgerEntry[] | undefined;
}

const FILE_PATH = path.join(process.cwd(), '.data', 'trust_ledger.jsonl');

async function appendToFile(line: string) {
  try {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.appendFile(FILE_PATH, line + '\n', 'utf8');
    return true;
  } catch {
    return false; // Vercel等では失敗しうる
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = (body?.address ?? null) as string | null;
  const score = Number(body?.score ?? 0);

  // --- DAO Vote（Mockだけど“政策”として見える形） ---
  const quorum = 60;
  const baseYes = Math.max(30, Math.min(90, Math.round(score)));
  const yes = Math.max(0, Math.min(100, baseYes + Math.floor(Math.random() * 10) - 5));
  const no = Math.max(0, Math.min(100, 100 - yes));
  const approved = yes >= quorum;

  const daoResult: DaoResult = {
    approved,
    txHash: randomHex(64),
    yes,
    no,
    quorum,
  };

  // --- Ledger chain ---
  const store = (globalThis.__TRUST_LEDGER__ ??= []);
  const last = store.length ? store[store.length - 1] : null;

  const height = last ? last.height + 1 : 1;
  const prevHash = last ? last.hash : null;

  const ledgerId = `ledger_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${String(height).padStart(6, '0')}`;

  const core: LedgerEntryCore = {
    kind: 'trust_kernel_v1',
    ledgerId,
    height,
    prevHash,
    address,
    score,
    daoResult,
    createdAt: new Date().toISOString(),
  };

  const hash = sha256Hex(JSON.stringify(core));
  const entry: LedgerEntry = { ...core, hash };

  store.push(entry);

  // ローカルならファイルにも追記（できたらOK）
  const fileOk = await appendToFile(JSON.stringify(entry));

  // timeline（直近N件）
  const timeline = store.slice(-20);

  return NextResponse.json({
    ok: true,
    entry,
    timeline,
    storage: { memory: true, file: fileOk },
  });
}
