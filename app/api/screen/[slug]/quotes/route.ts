import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { events, quotesLibrary } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction, isEventAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(quotesLibrary)
      .where(eq(quotesLibrary.eventId, event.id));

    return NextResponse.json({ quotes: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar citações.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const isOwnerOrAdmin = await isEventAdmin(slug);
    const authContext = await getEventMembershipContext(slug);

    if (!isOwnerOrAdmin && (!authContext || !hasPermission(authContext.role, authContext.permissions, 'quotes:manage'))) {
      return NextResponse.json({ error: 'Permissão insuficiente para gerir citações.' }, { status: 403 });
    }

    const body = await request.json() as {
      action?: 'add' | 'edit' | 'toggle' | 'delete';
      id?: number;
      category?: string;
      quote?: string;
      author?: string;
      isActive?: boolean;
    };

    const db = getDb();
    const [eventRow] = await db.select().from(events).where(eq(events.slug, slug.toLowerCase().trim())).limit(1);
    const eventId = authContext?.event?.id || eventRow?.id || 1;
    const now = new Date().toISOString();

    if (body.action === 'add' && body.quote) {
      const [newQuote] = await db
        .insert(quotesLibrary)
        .values({
          eventId,
          category: body.category || 'celebracao',
          quote: body.quote.trim(),
          author: body.author ? body.author.trim() : null,
          isActive: true,
          createdAt: now,
        })
        .returning();

      return NextResponse.json({ ok: true, quote: newQuote });
    }

    if (body.action === 'edit' && body.id && body.quote) {
      await db
        .update(quotesLibrary)
        .set({
          category: body.category || 'celebracao',
          quote: body.quote.trim(),
          author: body.author ? body.author.trim() : null,
        })
        .where(and(eq(quotesLibrary.id, body.id), eq(quotesLibrary.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'toggle' && body.id && typeof body.isActive === 'boolean') {
      await db
        .update(quotesLibrary)
        .set({ isActive: body.isActive })
        .where(and(eq(quotesLibrary.id, body.id), eq(quotesLibrary.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'delete' && body.id) {
      await db
        .delete(quotesLibrary)
        .where(and(eq(quotesLibrary.id, body.id), eq(quotesLibrary.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar citação.' },
      { status: 500 }
    );
  }
}
