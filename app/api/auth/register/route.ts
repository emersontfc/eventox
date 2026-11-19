import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { users, invitations, eventMemberships } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword, setAuthCookie, logAuditAction } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
    };

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();

    // Validations
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Endereço de email inválido.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Por favor indica o teu nome completo.' }, { status: 400 });
    }

    const db = getDb();

    // Check if user already exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma conta registada com este email. Por favor faz login.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        phone: phone || null,
        globalRole: 'user',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Check if there are pending invitations for this email and automatically accept them
    const pendingInvites = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.email, email), eq(invitations.status, 'pendente')));

    for (const inv of pendingInvites) {
      // Check expiration
      if (new Date(inv.expiresAt).getTime() > Date.now()) {
        await db.insert(eventMemberships).values({
          userId: newUser.id,
          eventId: inv.eventId,
          role: inv.role,
          permissions: inv.permissions,
          status: 'ativo',
          createdAt: now,
        }).onConflictDoNothing();

        await db.update(invitations).set({ status: 'aceite' }).where(eq(invitations.id, inv.id));
      }
    }

    await logAuditAction({
      userId: newUser.id,
      userName: newUser.name,
      action: 'user:register',
      entity: 'user',
      entityId: newUser.id,
      details: { email },
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
        globalRole: newUser.globalRole,
      },
    });

    setAuthCookie(response, newUser);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar conta.' },
      { status: 500 }
    );
  }
}
