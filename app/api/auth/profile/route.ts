import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword, verifyPassword, logAuditAction } from '../../../../lib/auth';
import { getDb } from '../../../../db';
import { users } from '../../../../db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      name?: string;
      phone?: string;
      avatarUrl?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const db = getDb();
    const [fullUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!fullUser) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name && body.name.trim().length >= 2) {
      updates.name = body.name.trim();
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone.trim() || null;
    }
    if (body.avatarUrl !== undefined) {
      updates.avatarUrl = body.avatarUrl.trim() || null;
    }

    // Password change
    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json(
          { error: 'É necessário introduzir a palavra-passe atual para definir uma nova.' },
          { status: 400 }
        );
      }
      if (!verifyPassword(body.currentPassword, fullUser.passwordHash)) {
        return NextResponse.json({ error: 'A palavra-passe atual está incorreta.' }, { status: 401 });
      }
      if (body.newPassword.length < 6) {
        return NextResponse.json(
          { error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' },
          { status: 400 }
        );
      }
      updates.passwordHash = hashPassword(body.newPassword);
    }

    await db.update(users).set(updates).where(eq(users.id, user.id));

    await logAuditAction({
      userId: user.id,
      userName: user.name,
      action: 'user:profile_update',
      entity: 'user',
      entityId: user.id,
      details: { changedPassword: Boolean(body.newPassword) },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: updates.name || user.name,
        phone: updates.phone !== undefined ? updates.phone : user.phone,
        avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : user.avatarUrl,
        globalRole: user.globalRole,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao atualizar perfil.' },
      { status: 500 }
    );
  }
}
