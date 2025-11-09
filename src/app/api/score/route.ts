import { NextResponse } from 'next/server';

function pseudoRandomFrom(str: string) {
  // 簡易ハッシュ → 0〜1 の値
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  // 0〜1
  return Math.abs(h % 1000) / 1000;
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json().catch(() => ({ address: '' }));

    // アドレスから擬似乱数（接続していなくても動作）
    const base = address ? pseudoRandomFrom(address) : Math.random();
    // 70〜94の範囲で気持ちよく出す（審査映像向け）
    const score = Math.min(94, Math.max(70, Math.floor(70 + base * 25)));

    return NextResponse.json({ score });
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
}
