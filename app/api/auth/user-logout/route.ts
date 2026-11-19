import { NextResponse } from 'next/server';
import { clearAuthCookie, getCurrentUser, logAuditAction } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await logAuditAction({
      userId: user.id,
      userName: user.name,
      action: 'user:logout',
      entity: 'user',
      entityId: user.id,
    });
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
