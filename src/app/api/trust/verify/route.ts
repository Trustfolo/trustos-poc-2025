import { NextResponse } from 'next/server';
import crypto from 'crypto';

function sha256Hex(input: string) {
  return '0x' + crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entry = body?.entry;
  const timeline = body?.timeline as any[] | undefined;

  if (!entry || !entry.hash) {
    return NextResponse.json({ ok: false, valid: false, reason: 'Missing entry/hash' }, { status: 400 });
  }

  const { hash, ...core } = entry;
  const recomputed = sha256Hex(JSON.stringify(core));
  const hashOk = recomputed === hash;

  let chainOk = true;
  let chainReason: string | null = null;

  // timeline が渡ってきた場合、prevHash の整合まで見る
  if (timeline && Array.isArray(timeline) && entry.prevHash) {
    const prev = timeline.find((x) => x.hash === entry.prevHash);
    if (!prev) {
      chainOk = false;
      chainReason = 'prevHash not found in timeline';
    }
  }

  const valid = hashOk && chainOk;

  return NextResponse.json({
    ok: true,
    valid,
    hash,
    recomputed,
    hashOk,
    chainOk,
    reason: valid ? null : (hashOk ? chainReason : 'Hash mismatch'),
    verifiedAt: new Date().toISOString(),
  });
}
