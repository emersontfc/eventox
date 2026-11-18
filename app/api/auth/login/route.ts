import { NextResponse } from 'next/server';
import { verifyEventPasscode, setSessionCookie } from '../../../../lib/auth';
import { getDb } from '../../../../db';
import { events } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { slug?: string; passcode?: string };
    const slug = String(body.slug || 'emerson').trim().toLowerCase();
    const passcode = String(body.passcode || '').trim();

    if (!slug || !passcode) {
      return NextResponse.json({ error: 'Código de acesso obrigatório.' }, { status: 400 });
    }

    const valid = await verifyEventPasscode(slug, passcode);
    if (!valid) {
      return NextResponse.json({ error: 'Código de acesso incorreto.' }, { status: 401 });
    }

    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    const eventId = event?.id || 1;

    const response = NextResponse.json({ ok: true, slug });
    setSessionCookie(response, slug, eventId);

    return response;
  } catch {
    return NextResponse.json({ error: 'Erro ao processar login.' }, { status: 500 });
  }
}
