'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, LockKeyhole, MapPin, Ticket, UtensilsCrossed } from 'lucide-react';
import Countdown from '../../../components/Countdown';
import ProgramTimeline from '../../../components/ProgramTimeline';
import { menuCategories, menuCategory, menuGroups } from '../../../lib/menu-categories';
import { INVITE_TIME_ZONE, type GuestInvitationData } from '../../../lib/guest-invitation';
import { resolveEventTheme } from '../../../lib/event-themes';

const dayFormat = new Intl.DateTimeFormat('pt-PT', {
  timeZone: INVITE_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const timeFormat = new Intl.DateTimeFormat('pt-PT', {
  timeZone: INVITE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const responseLabels: Record<string, string> = {
  pendente: 'Por confirmar',
  confirmado: 'Presença confirmada',
  recusado: 'Não comparece',
  presente: 'Entrada registada',
};

function InvitationMenu({ items }: { items: GuestInvitationData['menu'] }) {
  if (!items.length) return <p className="public-menu-empty">O cardápio ainda não foi publicado.</p>;

  return (
    <div className="invitation-menu">
      {menuGroups.map(group => {
        const categories = menuCategories.filter(category => category.group === group.id)
          .map(category => ({ ...category, items: items.filter(item => menuCategory(item.category).id === category.id) }))
          .filter(category => category.items.length);
        if (!categories.length) return null;

        return (
          <section key={group.id} className="public-menu-group">
            <h3>{group.label}</h3>
            <div className="public-menu-grid">
              {categories.map(category => (
                <section className="public-menu-card" key={category.id}>
                  <h4>{category.label}</h4>
                  <ul>
                    {category.items.map(item => (
                      <li key={item.id}>
                        <strong>{item.name}</strong>
                        {item.description && <p>{item.description}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function InvitationView({ token, initial }: { token: string; initial: GuestInvitationData | null }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'programa' | 'cardapio'>('programa');
  const endpoint = `/api/convites/${encodeURIComponent(token)}`;
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async (showError = false) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
      if (response.status === 404) {
        setData(null);
        return;
      }
      if (!response.ok) throw new Error('Não foi possível atualizar o convite.');
      setData(await response.json() as GuestInvitationData);
      setError('');
    } catch (failure) {
      if (!controller.signal.aborted && showError) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o convite.');
      }
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [endpoint]);

  const available = data !== null;
  const dayOpen = data?.dayOpen ?? false;
  const opensAt = data?.opensAt;
  useEffect(() => {
    if (!available || busy) return;
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(check, dayOpen ? 4500 : 30000);
    const wait = opensAt ? new Date(opensAt).getTime() - Date.now() : Infinity;
    const opening = !dayOpen && wait > 0 && wait < 30000 ? window.setTimeout(check, wait + 250) : undefined;
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      if (opening) window.clearTimeout(opening);
      document.removeEventListener('visibilitychange', check);
      request.current?.abort();
      request.current = null;
    };
  }, [available, busy, dayOpen, opensAt, refresh]);

  async function respond(member: number, status: 'confirmado' | 'recusado') {
    request.current?.abort();
    request.current = null;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível guardar a resposta.');
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="invitation-unavailable">
        <Ticket size={28} aria-hidden="true" />
        <h1>Convite indisponível</h1>
        <p>Confirma o endereço com a pessoa que te enviou o convite.</p>
      </main>
    );
  }

  const start = data.startsAt ? new Date(data.startsAt) : null;
  const theme = resolveEventTheme(data.coverTheme);
  const couple = data.members.length === 2;

  return (
    <main className={`event-portal-page invitation-portal ${theme.bodyClass}`}>
      <div className="invitation-wrap">
        <article className="invitation-card">
          <header className="invitation-cover">
            <p className="invitation-event-title"><Ticket size={17} aria-hidden="true" />{data.title}</p>
            <h1>
              <span className="sr-only">Convite pessoal para </span>
              {data.members.map((member, index) => (
                <span className="invitation-name" key={index}>{index > 0 && <span className="invitation-join">e</span>}{member.name}</span>
              ))}
            </h1>
            {data.hostName && <p className="invitation-host">A convite de {data.hostName}</p>}
          </header>

          <div className="invitation-details">
            <div>
              <CalendarDays size={20} aria-hidden="true" />
              <div><span>Data e hora</span>
                {start ? <strong><time dateTime={data.startsAt!}>{dayFormat.format(start)} · {timeFormat.format(start)}</time></strong>
                  : <strong>A anunciar</strong>}
              </div>
            </div>
            <div>
              <MapPin size={20} aria-hidden="true" />
              <div><span>Local</span><strong>{data.venue || 'A anunciar'}</strong>
                {data.venue && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.venue)}`}
                    target="_blank" rel="noreferrer">Ver no mapa</a>
                )}
              </div>
            </div>
          </div>

          <p className="invitation-terms">
            Convite pessoal e intransmissível, reservado {couple ? 'às pessoas indicadas' : 'à pessoa indicada'}. Não extensivo a crianças.
          </p>
        </article>

        {data.startsAt && <section className="invitation-countdown" aria-label="Contagem decrescente">
          <Countdown title="Até ao encontro" date={data.startsAt} />
        </section>}

        <section className="invitation-arrival">
          <div className="invitation-section-heading">
            <div>
              <h2>Presença e chegada</h2>
              <p>A mesa e o lugar aparecem aqui depois de a Receção registar a entrada.</p>
            </div>
            {dayOpen && <button type="button" onClick={() => void refresh(true)}>Atualizar</button>}
          </div>
          {error && <p className="invitation-error" role="alert">{error}</p>}
          <div className="invitation-members">
            {data.members.map((member, index) => (
              <article className="invitation-member" key={index}>
                <h3>{member.name}</h3>
                <p className="invitation-response" data-status={member.status}>{responseLabels[member.status] ?? 'Por confirmar'}</p>
                {member.seat ? (
                  <div className="invitation-seat" role="status">
                    <div><span>Mesa {member.seat.tableNumber}</span><strong>{member.seat.tableName}</strong></div>
                    <div><span>Lugar</span><strong>{member.seat.number}</strong></div>
                  </div>
                ) : (
                  <p className="invitation-seat-lock"><LockKeyhole size={15} aria-hidden="true" />Mesa e lugar disponíveis após a entrada.</p>
                )}
                {member.status !== 'presente' && (
                  <div className="invitation-rsvp-actions">
                    <button type="button" disabled={busy || member.status === 'confirmado'}
                      onClick={() => respond(index, 'confirmado')} className="invitation-confirm"
                      aria-label={`Confirmar presença de ${member.name}`}>
                      <Check size={16} aria-hidden="true" />{member.status === 'confirmado' ? 'Confirmado' : 'Confirmar presença'}
                    </button>
                    <button type="button" disabled={busy || member.status === 'recusado'}
                      onClick={() => respond(index, 'recusado')}
                      aria-label={`Indicar que ${member.name} não pode ir`}>Não posso ir</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {!dayOpen ? (
          <section className="invitation-locked">
            <Clock3 size={21} aria-hidden="true" />
            <div>
              <h2>Programa e cardápio</h2>
              <p>Disponíveis no dia do evento{opensAt ? `, a partir das 00:00 (hora local)` : ''}.</p>
            </div>
          </section>
        ) : (
          <section className="invitation-day">
            <div className="invitation-day-tabs" role="group" aria-label="No dia do evento">
              <button type="button" aria-pressed={section === 'programa'} onClick={() => setSection('programa')}>
                <Clock3 size={17} aria-hidden="true" />Programa
              </button>
              <button type="button" aria-pressed={section === 'cardapio'} onClick={() => setSection('cardapio')}>
                <UtensilsCrossed size={17} aria-hidden="true" />Cardápio e bar
              </button>
            </div>
            {section === 'programa' ? <ProgramTimeline items={data.program} /> : <InvitationMenu items={data.menu} />}
          </section>
        )}
        <footer className="invitation-footer">EventoX</footer>
      </div>
    </main>
  );
}
