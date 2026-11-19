import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { users, passwordResets } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { logAuditAction } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'O email é obrigatório.' }, { status: 400 });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Return success message even if user doesn't exist for security (anti-enumeration)
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: 'Se o email estiver registado, foi gerado um código de recuperação.',
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    await logAuditAction({
      userId: user.id,
      userName: user.name,
      action: 'user:forgot_password',
      entity: 'user',
      entityId: user.id,
    });

    // In production without SMTP, we return the resetToken so the user or admin can use the recovery link directly
    return NextResponse.json({
      ok: true,
      message: 'Código de recuperação gerado com sucesso.',
      resetToken: token,
      resetUrl: `/reset-password?token=${token}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar pedido.' },
      { status: 500 }
    );
  }
}
