import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { users, passwordResets } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword, logAuditAction } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; newPassword?: string };
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '').trim();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token e nova palavra-passe são obrigatórios.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const db = getDb();
    const [resetRecord] = await db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.token, token)))
      .limit(1);

    if (!resetRecord || resetRecord.usedAt) {
      return NextResponse.json({ error: 'Link de recuperação inválido ou já utilizado.' }, { status: 400 });
    }

    if (new Date(resetRecord.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este link de recuperação expirou. Solicita um novo.' }, { status: 400 });
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();

    await db.update(users).set({ passwordHash: newHash, updatedAt: now }).where(eq(users.id, resetRecord.userId));
    await db.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, resetRecord.id));

    await logAuditAction({
      userId: resetRecord.userId,
      action: 'user:reset_password',
      entity: 'user',
      entityId: resetRecord.userId,
    });

    return NextResponse.json({
      ok: true,
      message: 'Palavra-passe alterada com sucesso! Podes agora iniciar sessão.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao redefinir palavra-passe.' },
      { status: 500 }
    );
  }
}
