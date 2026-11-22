import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { users, events, eventMemberships } from '../../../../db/schema';
import { and, eq, or } from 'drizzle-orm';
import { verifyPassword, setAuthCookie, logAuditAction } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      password?: string;
    };

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e palavra-passe são obrigatórios.' }, { status: 400 });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Credenciais incorretas.' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Esta conta encontra-se suspensa ou desativada. Contacte o suporte.' },
        { status: 403 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Credenciais incorretas.' }, { status: 401 });
    }

    // Get list of accessible events for this user
    let userEvents: Array<{ id: number; slug: string; title: string; hostName: string; role: string }> = [];

    if (user.globalRole === 'admin') {
      const allEvents = await db.select().from(events);
      userEvents = allEvents.map((e: any) => ({
        id: e.id,
        slug: e.slug,
        title: e.title,
        hostName: e.hostName,
        role: 'proprietario',
      }));
    } else {
      const owned = await db.select().from(events).where(eq(events.ownerId, user.id));
      const memberships = await db
        .select({
          eventId: eventMemberships.eventId,
          role: eventMemberships.role,
        })
        .from(eventMemberships)
        .where(and(eq(eventMemberships.userId, user.id), eq(eventMemberships.status, 'ativo')));

      const memberEventIds = memberships.map((m: any) => m.eventId);
      const memberEvents = memberEventIds.length > 0
        ? await db.select().from(events).where(or(...memberEventIds.map((id: any) => eq(events.id, id))))
        : [];

      const roleMap = new Map<number, string>(memberships.map((m: any) => [m.eventId, m.role]));

      const combined = new Map<number, { id: number; slug: string; title: string; hostName: string; role: string }>();
      for (const e of owned) {
        combined.set(e.id, { id: e.id, slug: e.slug, title: e.title, hostName: e.hostName, role: 'proprietario' });
      }
      for (const e of memberEvents) {
        if (!combined.has(e.id)) {
          combined.set(e.id, {
            id: e.id,
            slug: e.slug,
            title: e.title,
            hostName: e.hostName,
            role: roleMap.get(e.id) || 'coorganizador',
          });
        }
      }
      userEvents = Array.from(combined.values());
    }

    await logAuditAction({
      userId: user.id,
      userName: user.name,
      action: 'user:login',
      entity: 'user',
      entityId: user.id,
      details: { email },
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        globalRole: user.globalRole,
      },
      events: userEvents,
    });

    setAuthCookie(response, user);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao iniciar sessão.' },
      { status: 500 }
    );
  }
}
