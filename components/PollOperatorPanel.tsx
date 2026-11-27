'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart3, Monitor, Plus, Trash2 } from 'lucide-react';
import { pollStatusLabels, type LivePoll, type PollCommand } from '@/lib/live-voting';
import './live-polls.css';

const commandErrors = 'Não foi possível guardar a votação.';

export default function PollOperatorPanel({ slug }: { slug: string }) {
  const endpoint = `/api/games/${encodeURIComponent(slug)}/polls`;
  const [polls, setPolls] = useState<LivePoll[] | null>(null);
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requestId = useRef(0);
  const hasOpenPoll = polls?.some(poll => poll.status === 'open' && poll.active) ?? false;

  useEffect(() => {
    if (busy) return;
    let request: AbortController | null = null;
    async function update() {
      if (document.visibilityState === 'hidden' || request) return;
      const id = ++requestId.current;
      request = new AbortController();
      try {
        const response = await fetch(`${endpoint}?manage=1`, { cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('Não foi possível carregar as votações.');
        const data = await response.json() as { polls: LivePoll[] };
        if (id === requestId.current) {
          setPolls(data.polls);
          setSyncError(false);
        }
      } catch {
        if (id === requestId.current) setSyncError(true);
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
  }, [endpoint, busy]);

  async function send(body: { action: 'create'; title: string; options: string[] } | { action: PollCommand; pollId: number }) {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    ++requestId.current;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json() as { polls: LivePoll[]; error?: string };
      if (!response.ok) throw new Error(data.error || commandErrors);
      setPolls(data.polls);
      if (body.action === 'create') {
        setTitle('');
        setOptions(['', '']);
      }
      const notices: Record<typeof body.action, string> = {
        create: 'Rascunho guardado.',
        open: 'Votação aberta aos convidados.',
        close: 'Votação encerrada.',
        reveal: 'Resultados publicados.',
        project: 'Votação selecionada para projeção.',
        delete: 'Rascunho eliminado.',
      };
      setFeedback(notices[body.action]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : commandErrors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-poll-operator" aria-label="Gerir votações">
      <div className="live-poll-heading"><BarChart3 size={22} aria-hidden="true" /><h2>Votações</h2></div>
      <p>Os convidados votam pelo convite pessoal, com um voto por pessoa.</p>
      {error && <p className="live-poll-error" role="alert">{error}</p>}
      {syncError && <p className="live-poll-error" role="status">Não foi possível atualizar as votações.</p>}
      {feedback && <p className="live-poll-confirmed" role="status">{feedback}</p>}
      <div className="live-poll-operator-layout">
        <form className="live-poll-operator-card" onSubmit={event => {
          event.preventDefault();
          void send({ action: 'create', title, options });
        }}>
          <h3>Nova votação</h3>
          <label>Pergunta
            <input required maxLength={140} value={title} placeholder="Que música ouvimos a seguir?"
              disabled={busy} onChange={event => setTitle(event.target.value)} />
          </label>
          {options.map((option, index) => (
            <div className="live-poll-option-field" key={index}>
              <label>Opção {index + 1}
                <input required maxLength={80} value={option} disabled={busy}
                  onChange={event => setOptions(previous =>
                    previous.map((value, position) => position === index ? event.target.value : value))} />
              </label>
              {options.length > 2 && (
                <button type="button" className="live-poll-secondary" aria-label={`Retirar opção ${index + 1}`}
                  disabled={busy} onClick={() => setOptions(previous => previous.filter((_, position) => position !== index))}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <div className="live-poll-actions">
            <button className="live-poll-secondary" type="button" disabled={busy || options.length >= 6}
              onClick={() => setOptions(previous => [...previous, ''])}><Plus size={16} /> Opção</button>
            <button className="live-poll-primary" type="submit" disabled={busy}>Guardar rascunho</button>
          </div>
        </form>

        <div className="live-poll-list">
          {!polls && <p>A carregar votações…</p>}
          {polls?.length === 0 && <p>Ainda não há votações.</p>}
          {polls?.map(poll => (
            <article className="live-poll-operator-card" key={poll.id} data-active={poll.active}>
              <div className="live-poll-title-row">
                <h3>{poll.title}</h3><span>{pollStatusLabels[poll.status]}</span>
              </div>
              <ul className="live-poll-options-summary">
                {poll.options.map(option => (
                  <li key={option.id}><span>{option.label}</span><strong>{option.votes}</strong></li>
                ))}
              </ul>
              {poll.status !== 'draft' && <p>{poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}</p>}
              <div className="live-poll-actions">
                {poll.status === 'draft' && (
                  <>
                    <button type="button" className="live-poll-primary" disabled={busy || hasOpenPoll}
                      onClick={() => void send({ action: 'open', pollId: poll.id })}>Abrir votação</button>
                    <button type="button" className="live-poll-secondary" disabled={busy}
                      onClick={() => void send({ action: 'delete', pollId: poll.id })}>Eliminar rascunho</button>
                  </>
                )}
                {poll.active && (
                  <>
                    {poll.status === 'open' && <button type="button" className="live-poll-primary" disabled={busy}
                      onClick={() => void send({ action: 'close', pollId: poll.id })}>Encerrar votação</button>}
                    {poll.status === 'closed' && <button type="button" className="live-poll-primary" disabled={busy}
                      onClick={() => void send({ action: 'reveal', pollId: poll.id })}>Publicar resultados</button>}
                    <button type="button" className="live-poll-secondary" disabled={busy}
                      onClick={() => void send({ action: 'project', pollId: poll.id })}>
                      <Monitor size={16} /> Enviar para o ecrã
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
