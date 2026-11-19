import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { invitations } from '../../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getEventMembershipContext, logAuditAction } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:view')) {
      return NextResponse.json({ error: 'Acesso reservado.' }, { status: 403 });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.eventId, authContext.event.id));

    return NextResponse.json({ invitations: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar convites.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:invite')) {
      return NextResponse.json({ error: 'Permissão insuficiente para criar convites.' }, { status: 403 });
    }

    const body = await request.json() as {
      email?: string;
      role?: string;
      permissions?: string[];
      validityDays?: number;
    };

    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const role = String(body.role || 'coorganizador');
    const permissions = JSON.stringify(body.permissions || []);
    const validityDays = Math.min(30, Math.max(1, Number(body.validityDays) || 7));

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const db = getDb();
    const [newInvite] = await db
      .insert(invitations)
      .values({
        eventId: authContext.event.id,
        email,
        role,
        permissions,
        token,
        expiresAt,
        status: 'pendente',
        invitedBy: authContext.user.id,
        createdAt: now,
      })
      .returning();

    await logAuditAction({
      eventId: authContext.event.id,
      userId: authContext.user.id,
      userName: authContext.user.name,
      action: 'team:create_invite',
      entity: 'invitation',
      entityId: newInvite.id,
      details: { email, role, validityDays },
    });

    const inviteUrl = `/invite/${token}`;

    return NextResponse.json({
      ok: true,
      invitation: newInvite,
      inviteUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar convite.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:invite')) {
      return NextResponse.json({ error: 'Permissão insuficiente para revogar convites.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const inviteId = Number(url.searchParams.get('id'));

    if (!inviteId) {
      return NextResponse.json({ error: 'Identificador de convite obrigatório.' }, { status: 400 });
    }

    const db = getDb();
    await db
      .update(invitations)
      .set({ status: 'revogado' })
      .where(and(eq(invitations.id, inviteId), eq(invitations.eventId, authContext.event.id)));

    await logAuditAction({
      eventId: authContext.event.id,
      userId: authContext.user.id,
      userName: authContext.user.name,
      action: 'team:revoke_invite',
      entity: 'invitation',
      entityId: inviteId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao revogar convite.' },
      { status: 500 }
    );
  }
}
