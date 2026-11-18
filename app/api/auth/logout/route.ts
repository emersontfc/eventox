import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { slug?: string };
    const slug = String(body.slug || 'emerson').trim().toLowerCase();

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(`eventox_admin_${slug}`);
    response.cookies.delete('eventox_master');
    return response;
  } catch {
    return NextResponse.json({ ok: true });
  }
}
