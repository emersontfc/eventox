import { NextResponse } from 'next/server';
import { readGuestInvitation, updateInvitationResponse } from '../../../../lib/guest-invitation-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ token: string }> };
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const invite = await readGuestInvitation(token);
  return invite ? json(invite) : json({ error: 'Este convite já não está disponível.' }, 404);
}

export async function POST(request: Request, context: Context) {
  const { token } = await context.params;
  const body = await request.json().catch(() => null);
  if ((body?.member !== 0 && body?.member !== 1) || !['confirmado', 'recusado'].includes(body?.status)) {
    return json({ error: 'Resposta inválida.' }, 400);
  }
  if (!updateInvitationResponse(token, body.member, body.status)) {
    return json({ error: 'A resposta já não pode ser alterada.' }, 409);
  }
  const invite = await readGuestInvitation(token);
  return invite ? json(invite) : json({ error: 'Este convite já não está disponível.' }, 404);
}
