import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { events } from '@/db/schema';
import { getEventMembershipContext } from '@/lib/auth';
import { invitationDates } from '@/lib/guest-invitation';
import { hasPermission } from '@/lib/permissions';
import type { PollCommand } from '@/lib/live-voting';
import {
  createLivePoll, getGuestPoll, getManagedLivePolls, manageLivePoll, PollError, recordPollVote,
} from '@/lib/live-voting-server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function failure(error: unknown) {
  if (error instanceof PollError) return reply({ error: error.message }, error.status);
  return reply({ error: 'Não foi possível processar a votação.' }, 500);
}

function eventForSlug(slug: string): { id: number; eventDate: string } {
  const event = getDb().select({ id: events.id, eventDate: events.eventDate })
    .from(events).where(eq(events.slug, slug)).get();
  if (!event) throw new PollError(404, 'Evento não encontrado.');
  return event;
}

async function operatorEvent(slug: string) {
  const access = await getEventMembershipContext(slug);
  if (!access || !(
    hasPermission(access.role, access.permissions, 'games:host') ||
    hasPermission(access.role, access.permissions, 'games:manage')
  )) throw new PollError(403, 'Sem permissão para gerir votações.');
  return access.event;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const slug = (await params).slug.toLowerCase().trim();
    if (new URL(request.url).searchParams.get('manage') === '1') {
      const event = await operatorEvent(slug);
      return reply({ polls: getManagedLivePolls(event.id) });
    }

    const event = eventForSlug(slug);
    if (!invitationDates(event.eventDate).dayOpen) return reply({ poll: null, voters: [] });
    return reply(getGuestPoll(event.id, request.headers.get('x-eventox-invitation')));
  } catch (error) {
    return failure(error);
  }
}

const commands: PollCommand[] = ['open', 'close', 'reveal', 'project', 'delete'];
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const slug = (await params).slug.toLowerCase().trim();
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PollError(400, 'Operação inválida.');
    const body = input as Record<string, unknown>;

    if (body.action === 'vote') {
      const event = eventForSlug(slug);
      if (!invitationDates(event.eventDate).dayOpen) throw new PollError(409, 'As votações começam no dia do evento.');
      if (!isId(body.pollId) || !isId(body.optionId) || (body.member !== 0 && body.member !== 1)) {
        throw new PollError(400, 'Seleciona um convidado e uma opção válidos.');
      }
      const token = request.headers.get('x-eventox-invitation');
      recordPollVote(event.id, token, body.pollId, body.optionId, body.member);
      return reply(getGuestPoll(event.id, token));
    }

    const event = await operatorEvent(slug);
    if (body.action === 'create') {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const labels: string[] = Array.isArray(body.options) ? body.options.map((value: unknown) =>
        typeof value === 'string' ? value.trim() : '',
      ) : [];
      if (!title || title.length > 140 || labels.length < 2 || labels.length > 6 ||
        labels.some(label => !label || label.length > 80)) {
        throw new PollError(400, 'Indica uma pergunta e entre duas e seis opções.');
      }
      const uniqueLabels = new Set(labels.map(label => label.normalize('NFKC').toLocaleLowerCase('pt')));
      if (uniqueLabels.size !== labels.length) throw new PollError(400, 'As opções devem ser diferentes.');
      createLivePoll(event.id, title, labels);
      return reply({ polls: getManagedLivePolls(event.id) }, 201);
    }

    const command = commands.find(value => value === body.action);
    if (!command || !isId(body.pollId)) throw new PollError(400, 'Operação inválida.');
    manageLivePoll(event.id, body.pollId, command);
    return reply({ polls: getManagedLivePolls(event.id) });
  } catch (error) {
    return failure(error);
  }
}
