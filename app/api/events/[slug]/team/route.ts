import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { events, users, eventMemberships, invitations, auditLogs } from '../../../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getEventMembershipContext, logAuditAction } from '../../../../../lib/auth';
import { hasPermission, ROLE_DEFINITIONS, EventRole } from '../../../../../lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:view')) {
      return NextResponse.json({ error: 'Acesso reservado à equipa de organização.' }, { status: 403 });
    }

    const db = getDb();
    const eventId = authContext.event.id;

    // 1. Members list
    const memberRows = await db
      .select({
        membershipId: eventMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: eventMemberships.role,
        permissions: eventMemberships.permissions,
        status: eventMemberships.status,
        createdAt: eventMemberships.createdAt,
      })
      .from(eventMemberships)
      .innerJoin(users, eq(eventMemberships.userId, users.id))
      .where(eq(eventMemberships.eventId, eventId));

    // Also include event owner if not in memberships table
    if (authContext.event.ownerId) {
      const isOwnerInMembers = memberRows.some((m: any) => m.userId === authContext.event.ownerId);
      if (!isOwnerInMembers) {
        const [ownerUser] = await db.select().from(users).where(eq(users.id, authContext.event.ownerId)).limit(1);
        if (ownerUser) {
          memberRows.unshift({
            membershipId: 0,
            userId: ownerUser.id,
            name: ownerUser.name,
            email: ownerUser.email,
            phone: ownerUser.phone,
            avatarUrl: ownerUser.avatarUrl,
            role: 'proprietario',
            permissions: JSON.stringify(['*']),
            status: 'ativo',
            createdAt: authContext.event.createdAt,
          });
        }
      }
    }

    // 2. Active invitations
    const inviteRows = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        permissions: invitations.permissions,
        token: invitations.token,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(eq(invitations.eventId, eventId))
      .orderBy(desc(invitations.id));

    // 3. Recent audit logs for this event
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.eventId, eventId))
      .orderBy(desc(auditLogs.id))
      .limit(30);

    return NextResponse.json({
      members: memberRows.map((m: any) => {
        let perms: string[] = [];
        try { perms = JSON.parse(m.permissions || '[]'); } catch { perms = []; }
        return {
          ...m,
          permissions: perms,
          roleDefinition: ROLE_DEFINITIONS[m.role as EventRole] || null,
        };
      }),
      invitations: inviteRows,
      auditLogs: logs,
      roles: Object.values(ROLE_DEFINITIONS),
      currentRole: authContext.role,
      isOwner: authContext.role === 'proprietario',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao listar equipa.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:manage')) {
      return NextResponse.json({ error: 'Permissão insuficiente para alterar membros.' }, { status: 403 });
    }

    const body = await request.json() as {
      action?: 'update-role' | 'update-status' | 'update-permissions';
      membershipId?: number;
      userId?: number;
      role?: string;
      status?: 'ativo' | 'suspenso' | 'bloqueado';
      permissions?: string[];
    };

    const db = getDb();
    const eventId = authContext.event.id;

    if (body.action === 'update-role' && body.userId && body.role) {
      // Cannot change owner role unless user is global admin
      if (body.userId === authContext.event.ownerId && authContext.user.globalRole !== 'admin') {
        return NextResponse.json({ error: 'Não é possível alterar o cargo do proprietário do evento.' }, { status: 400 });
      }

      await db
        .update(eventMemberships)
        .set({ role: body.role })
        .where(and(eq(eventMemberships.userId, body.userId), eq(eventMemberships.eventId, eventId)));

      await logAuditAction({
        eventId,
        userId: authContext.user.id,
        userName: authContext.user.name,
        action: 'team:change_role',
        entity: 'membership',
        entityId: body.userId,
        details: { targetUserId: body.userId, newRole: body.role },
      });

      return NextResponse.json({ ok: true, role: body.role });
    }

    if (body.action === 'update-status' && body.userId && body.status) {
      if (body.userId === authContext.event.ownerId) {
        return NextResponse.json({ error: 'Não é possível suspender o proprietário.' }, { status: 400 });
      }

      await db
        .update(eventMemberships)
        .set({ status: body.status })
        .where(and(eq(eventMemberships.userId, body.userId), eq(eventMemberships.eventId, eventId)));

      await logAuditAction({
        eventId,
        userId: authContext.user.id,
        userName: authContext.user.name,
        action: 'team:change_status',
        entity: 'membership',
        entityId: body.userId,
        details: { targetUserId: body.userId, newStatus: body.status },
      });

      return NextResponse.json({ ok: true, status: body.status });
    }

    if (body.action === 'update-permissions' && body.userId) {
      const permsStr = JSON.stringify(body.permissions || []);
      await db
        .update(eventMemberships)
        .set({ permissions: permsStr })
        .where(and(eq(eventMemberships.userId, body.userId), eq(eventMemberships.eventId, eventId)));

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar membro.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const authContext = await getEventMembershipContext(slug);

    if (!authContext || !hasPermission(authContext.role, authContext.permissions, 'team:manage')) {
      return NextResponse.json({ error: 'Permissão insuficiente para remover membros.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const targetUserId = Number(url.searchParams.get('userId'));

    if (!targetUserId) {
      return NextResponse.json({ error: 'Identificador de utilizador obrigatório.' }, { status: 400 });
    }

    if (targetUserId === authContext.event.ownerId) {
      return NextResponse.json({ error: 'O proprietário do evento não pode ser removido.' }, { status: 400 });
    }

    const db = getDb();
    await db
      .delete(eventMemberships)
      .where(and(eq(eventMemberships.userId, targetUserId), eq(eventMemberships.eventId, authContext.event.id)));

    await logAuditAction({
      eventId: authContext.event.id,
      userId: authContext.user.id,
      userName: authContext.user.name,
      action: 'team:remove_member',
      entity: 'membership',
      entityId: targetUserId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao remover membro.' },
      { status: 500 }
    );
  }
}
