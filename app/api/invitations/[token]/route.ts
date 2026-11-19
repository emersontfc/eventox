import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { invitations, events, users, eventMemberships } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser, logAuditAction } from '../../../../lib/auth';
import { ROLE_DEFINITIONS, EventRole } from '../../../../lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const db = getDb();

    const [invite] = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        eventId: invitations.eventId,
        invitedBy: invitations.invitedBy,
      })
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
    }

    const [event] = await db.select().from(events).where(eq(events.id, invite.eventId)).limit(1);
    if (!event) {
      return NextResponse.json({ error: 'Evento associado não encontrado.' }, { status: 404 });
    }

    let inviterName = 'Organização';
    if (invite.invitedBy) {
      const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, invite.invitedBy)).limit(1);
      if (inviter) inviterName = inviter.name;
    }

    const isExpired = new Date(invite.expiresAt).getTime() < Date.now();
    const roleDef = ROLE_DEFINITIONS[invite.role as EventRole] || null;

    return NextResponse.json({
      valid: invite.status === 'pendente' && !isExpired,
      status: isExpired ? 'expirado' : invite.status,
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        hostName: event.hostName,
        eventDate: event.eventDate,
        venue: event.venue,
      },
      inviterName,
      role: invite.role,
      roleLabel: roleDef?.label || invite.role,
      roleDescription: roleDef?.description || '',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao consultar convite.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Inicia sessão ou cria uma conta para aceitar o convite.', requiresAuth: true },
        { status: 401 }
      );
    }

    const db = getDb();
    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
    }

    if (invite.status !== 'pendente' || new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este convite já não se encontra ativo ou expirou.' }, { status: 400 });
    }

    const [event] = await db.select().from(events).where(eq(events.id, invite.eventId)).limit(1);
    if (!event) {
      return NextResponse.json({ error: 'Evento associado não encontrado.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Insert or update membership
    await db
      .insert(eventMemberships)
      .values({
        userId: user.id,
        eventId: event.id,
        role: invite.role,
        permissions: invite.permissions,
        status: 'ativo',
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [eventMemberships.userId, eventMemberships.eventId],
        set: {
          role: invite.role,
          permissions: invite.permissions,
          status: 'ativo',
        },
      });

    // Mark invitation as accepted
    await db.update(invitations).set({ status: 'aceite' }).where(eq(invitations.id, invite.id));

    await logAuditAction({
      eventId: event.id,
      userId: user.id,
      userName: user.name,
      action: 'invitation:accept',
      entity: 'membership',
      entityId: user.id,
      details: { role: invite.role },
    });

    return NextResponse.json({
      ok: true,
      message: 'Convite aceite com sucesso!',
      slug: event.slug,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao aceitar convite.' },
      { status: 500 }
    );
  }
}
