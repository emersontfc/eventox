import { NextResponse } from 'next/server';
import { verifyEventPasscode } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { slug?: string; passcode?: string };
    const slug = String(body.slug || 'emerson').trim().toLowerCase();
    const passcode = String(body.passcode || '');

    const valid = await verifyEventPasscode(slug, passcode);
    if (!valid) {
      return NextResponse.json({ error: 'Código de acesso incorreto.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, slug });
    
    // Set HTTP-only cookie for this event
    response.cookies.set(`eventox_admin_${slug}`, 'authenticated', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (passcode === 'emerson2026') {
      response.cookies.set('eventox_master', 'true', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao processar login.' }, { status: 500 });
  }
}
