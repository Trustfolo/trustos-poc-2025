import { NextResponse } from 'next/server';

type ScoreResponse = {
  ok: boolean;
  address: string;
  score: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { address?: string };

    if (!body.address) {
      return NextResponse.json(
        { ok: false, address: '', score: 0 },
        { status: 400 }
      );
    }

    // mock score
    const score = Math.floor(60 + Math.random() * 30);

    const res: ScoreResponse = {
      ok: true,
      address: body.address,
      score,
    };

    return NextResponse.json(res);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, address: '', score: 0, message },
      { status: 500 }
    );
  }
}
