import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=8&format=json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await res.json();
    const items = data.data ?? [];
    return NextResponse.json({
      current:   items[0] ?? null,
      yesterday: items[1] ?? null,
      weekAgo:   items[7] ?? items[6] ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
