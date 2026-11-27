import { NextResponse } from 'next/server';
import { getEventMembershipContext } from '../../../../../lib/auth';
import { readOperatorLiveProgram, updateLiveProgram } from '../../../../../lib/live-program-server';
import { hasPermission } from '../../../../../lib/permissions';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ slug: string }> };

async function eventForOperator(context: Context) {
  const { slug } = await context.params;
  const access = await getEventMembershipContext(slug);
  if (!access) return null;
  const canOperate = hasPermission(access.role, access.permissions, 'screen:control') ||
    hasPermission(access.role, access.permissions, 'event:manage');
  return canOperate ? access.event : null;
}

function json(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(_request: Request, context: Context) {
  const event = await eventForOperator(context);
  if (!event) return json({ error: 'Acesso reservado à organização.' }, 403);
  return json(readOperatorLiveProgram(event.id, event.slug));
}

export async function POST(request: Request, context: Context) {
  const event = await eventForOperator(context);
  if (!event) return json({ error: 'Acesso reservado à organização.' }, 403);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const type = body?.type;
  const revision = body?.revision;
  if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)) {
    return json({ error: 'Atualiza o programa antes de alterar o momento.' }, 400);
  }

  const action = type === 'select' && typeof body?.index === 'number' && Number.isInteger(body.index)
    ? { type, index: body.index } as const
    : type === 'advance' || type === 'complete' || type === 'reset' ? { type } as const : null;
  if (!action) return json({ error: 'Ação inválida.' }, 400);

  const result = updateLiveProgram(event.id, event.slug, revision, action);
  return result.error ? json(result, 409) : json(result.state);
}
