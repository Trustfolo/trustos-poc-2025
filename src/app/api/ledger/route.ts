import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const LEDGER_DIR = path.join(process.cwd(), 'data');
const LEDGER_FILE = path.join(LEDGER_DIR, 'ledger.jsonl');

// できるだけ安定したJSON文字列化（key順を固定）
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',')}}`;
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function ensureLedgerFile() {
  if (!fs.existsSync(LEDGER_DIR)) fs.mkdirSync(LEDGER_DIR, { recursive: true });
  if (!fs.existsSync(LEDGER_FILE)) fs.writeFileSync(LEDGER_FILE, '', 'utf8');
}

function getLastEntry(): any | null {
  ensureLedgerFile();
  const content = fs.readFileSync(LEDGER_FILE, 'utf8').trim();
  if (!content) return null;
  const lines = content.split('\n');
  const last = lines[lines.length - 1];
  try {
    return JSON.parse(last);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const address = body?.address ?? null;
  const scorePayload = body?.scorePayload ?? null;
  const daoPayload = body?.daoPayload ?? null;

  const last = getLastEntry();
  const prevHash: string = last?.hash ?? 'GENESIS';

  const entry = {
    schema: 'trustos-ledger-v1',
    ts: new Date().toISOString(),
    address,
    scorePayload,
    daoPayload,
    prevHash,
  };

  const canonical = stableStringify(entry);
  const hash = sha256Hex(canonical);

  const stored = { ...entry, hash };

  ensureLedgerFile();
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(stored) + '\n', 'utf8');

  return NextResponse.json({ ok: true, entry: stored });
}

export async function GET() {
  ensureLedgerFile();
  const content = fs.readFileSync(LEDGER_FILE, 'utf8').trim();
  const lines = content ? content.split('\n') : [];
  const last20 = lines.slice(-20).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return NextResponse.json({ ok: true, items: last20 });
}
