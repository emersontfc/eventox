import { NextResponse } from 'next/server';
import { getEventMembershipContext } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { ProjectionError, readProjectionQueue, runProjectionCommand } from '@/lib/projection-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string }> };
type Command = Parameters<typeof runProjectionCommand>[1];
const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function duration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 5 && value <= 120;
}

function parseCommand(body: unknown): Command | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { action, kind, sourceId, id, durationSeconds, direction } = body as Record<string, unknown>;
  if (action === 'enqueue' && (kind === 'photos' || kind === 'messages') && positiveId(sourceId) &&
      (durationSeconds === undefined || duration(durationSeconds))) {
    return { action, kind, sourceId, durationSeconds };
  }
  if (action === 'skip' || action === 'return') return { action };
  if (!positiveId(id)) return null;
  if (action === 'prepare' || action === 'project' || action === 'remove') return { action, id };
  if (action === 'duration' && duration(durationSeconds)) return { action, id, durationSeconds };
  if (action === 'move' && (direction === 'up' || direction === 'down')) return { action, id, direction };
  return null;
}

export async function GET(_request: Request, { params }: Context) {
  const { slug } = await params;
  const access = await getEventMembershipContext(slug);
  if (!access || !hasPermission(access.role, access.permissions, 'screen:control')) {
    return json({ error: 'Acesso reservado ao operador do ecrã.' }, 403);
  }
  return json(readProjectionQueue(access.event));
}

export async function POST(request: Request, { params }: Context) {
  const { slug } = await params;
  const access = await getEventMembershipContext(slug);
  if (!access) return json({ error: 'Acesso reservado à equipa.' }, 403);

  const command = parseCommand(await request.json().catch(() => null));
  if (!command) return json({ error: 'Ação de projeção inválida.' }, 400);

  const canControl = hasPermission(access.role, access.permissions, 'screen:control');
  const canEnqueue = command.action === 'enqueue' &&
    hasPermission(access.role, access.permissions, 'gallery:moderate');
  if (!canControl && !canEnqueue) return json({ error: 'Sem permissão para esta ação.' }, 403);

  try {
    const queue = runProjectionCommand(access.event, command);
    return json(canControl ? queue : { ok: true });
  } catch (failure) {
    if (failure instanceof ProjectionError) return json({ error: failure.message }, failure.status);
    console.error('Falha na fila de projeção', failure);
    return json({ error: 'Não foi possível atualizar a fila de projeção.' }, 500);
  }
}
