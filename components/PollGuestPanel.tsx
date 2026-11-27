'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Vote } from 'lucide-react';
import type { GuestPoll } from '@/lib/live-voting';
import './live-polls.css';

export default function PollGuestPanel({ slug, token }: { slug: string; token?: string }) {
  const endpoint = `/api/games/${encodeURIComponent(slug)}/polls`;
  const [data, setData] = useState<GuestPoll | null>(null);
  const [member, setMember] = useState<number | null>(null);
  const [option, setOption] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const requestId = useRef(0);
  const headers = useCallback((): Record<string, string> => token
    ? { 'x-eventox-invitation': token } : {}, [token]);

  useEffect(() => {
    if (!slug || busy) return;
    let request: AbortController | null = null;
    async function update() {
      if (document.visibilityState === 'hidden' || request) return;
      const id = ++requestId.current;
      request = new AbortController();
      try {
        const response = await fetch(endpoint, { cache: 'no-store', headers: headers(), signal: request.signal });
        if (!response.ok) throw new Error('Não foi possível atualizar a votação.');
        const next = await response.json() as GuestPoll;
        if (requestId.current === id) {
          setData(next);
          setSyncError(false);
        }
      } catch (failure) {
        if (requestId.current === id && !(failure instanceof DOMException && failure.name === 'AbortError')) {
          setSyncError(true);
        }
      } finally {
        request = null;
      }
    }

    void update();
    const interval = window.setInterval(update, 3000);
    document.addEventListener('visibilitychange', update);
    return () => {
      ++requestId.current;
      request?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, [slug, endpoint, headers, busy]);

  const poll = data?.poll;
  const voters = data?.voters ?? [];
  const selected = voters.find(voter => voter.member === member) ??
    (voters.length === 1 ? voters[0] : undefined);

  useEffect(() => {
    setOption(null);
    setError('');
  }, [poll?.id, selected?.member]);

  async function vote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !poll || option === null || !selected) return;
    setBusy(true);
    setError('');
    ++requestId.current;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId: poll.id, optionId: option, member: selected.member }),
      });
      const result = await response.json() as GuestPoll & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível registar o voto.');
      setData(result);
      setOption(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível registar o voto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-poll-guest" aria-label="Votação ao vivo">
      <div className="live-poll-heading">
        <Vote size={22} aria-hidden="true" />
        <h2>Votação ao vivo</h2>
      </div>
      {error && <p className="live-poll-error" role="alert">{error}</p>}
      {syncError && <p className="live-poll-error" role="status">Não foi possível atualizar. A tentar novamente…</p>}
      {!token && <p>Abre o teu convite pessoal e escolhe <strong>Votação ao vivo</strong> para participar.</p>}
      {!data && <p>A carregar votação…</p>}
      {data && !poll && <p>Nenhuma votação aberta neste momento.</p>}
      {poll && (
        <>
          <h3>{poll.title}</h3>
          {token && voters.length === 0 && <p>O link do convite deixou de permitir votar.</p>}
          {voters.length > 1 && (
            <fieldset className="live-poll-voters">
              <legend>Quem vai votar?</legend>
              {voters.map(voter => (
                <button key={voter.member} type="button" aria-pressed={selected?.member === voter.member}
                  disabled={busy} onClick={() => setMember(voter.member)}>
                  {voter.name}
                  {voter.optionId !== null && <CheckCircle2 size={16} aria-label="Voto registado" />}
                </button>
              ))}
            </fieldset>
          )}
          {selected?.optionId != null && (
            <p className="live-poll-confirmed" role="status">
              <CheckCircle2 size={16} aria-hidden="true" />
              Voto de {selected.name} registado.
            </p>
          )}
          {poll.status === 'open' && selected?.optionId === null && (
            <form onSubmit={vote}>
              <fieldset disabled={busy} className="live-poll-options">
                <legend>Escolhe uma opção</legend>
                {poll.options.map(choice => (
                  <label key={choice.id}>
                    <input type="radio" name={`poll-${poll.id}`} value={choice.id}
                      checked={option === choice.id} onChange={() => setOption(choice.id)} />
                    {choice.label}
                  </label>
                ))}
              </fieldset>
              <button className="live-poll-primary" type="submit" disabled={option === null || busy}>
                {busy ? 'A registar…' : 'Confirmar voto'}
              </button>
            </form>
          )}
          {poll.status === 'closed' && <p role="status">Votação encerrada. Aguarda os resultados.</p>}
          {poll.status === 'revealed' && (
            <div className="live-poll-results" aria-label="Resultados">
              <p>{poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}</p>
              <ul>
                {poll.options.map(choice => {
                  const percent = poll.totalVotes ? Math.round((choice.votes ?? 0) * 100 / poll.totalVotes) : 0;
                  return (
                    <li key={choice.id}>
                      <div><strong>{choice.label}</strong><span>{choice.votes} · {percent}%</span></div>
                      <progress value={percent} max={100} aria-label={`${choice.label}: ${percent}%`} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
