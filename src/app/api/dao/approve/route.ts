import { NextResponse } from 'next/server';

function randomHex(len = 64) {
  const chars = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const score = Number(body?.score ?? 0);

  const quorum = 60;

  // PoC：scoreに応じてYESが増える
  const baseYes = Math.max(30, Math.min(90, Math.round(score)));
  const yes = Math.max(0, Math.min(100, baseYes + Math.floor(Math.random() * 10) - 5));
  const no = Math.max(0, Math.min(100, 100 - yes));

  return NextResponse.json({
    ok: true,
    dao: {
      approved: yes >= quorum,
      txHash: randomHex(64),
      yes,
      no,
      quorum,
    },
    ts: new Date().toISOString(),
  });
}
