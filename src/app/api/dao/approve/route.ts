import { NextResponse } from 'next/server';

function randomHex(len = 64) {
  const chars = '0123456789abcdef';
  let out = '0x';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: Request) {
  try {
    const { address = '', score = 0 } = await req.json().catch(() => ({}));

    // 投票をモック（スコアが高いほど YES が増えやすい）
    const baseYes = Math.max(1, Math.floor((Number(score) || 0) / 10)); // 0〜10台 → 0〜9票ベース
    const noiseYes = Math.floor(Math.random() * 5); // 0〜4
    const yes = baseYes + noiseYes + 5; // 少し底上げ（見栄え）
    const no = Math.floor(Math.random() * 4); // 0〜3
    const quorum = yes + no + Math.floor(Math.random() * 5); // 見栄え用

    const approved = yes > no && Number(score) >= 60;
    const txHash = randomHex(64);

    return NextResponse.json({
      approved,
      txHash,
      votes: { yes, no, quorum },
    });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}

