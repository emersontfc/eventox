import { NextResponse } from 'next/server';
import { clearSessionCookie } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { slug?: string };
    const slug = String(body.slug || 'emerson').trim().toLowerCase();

    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response, slug);
    return response;
  } catch {
    return NextResponse.json({ ok: true });
  }
}
