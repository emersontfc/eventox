'use client';

import { ArrowDown, ArrowUp, Eye, Monitor, SkipForward, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectionQueueState } from '@/lib/projection';
import ProjectionPreview from './ProjectionPreview';

const durationChoices = [5, 8, 12, 15, 20, 30, 45, 60, 120];

export default function ProjectionQueue({ slug }: { slug: string }) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/projection`;
  const [queue, setQueue] = useState<ProjectionQueueState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const reading = useRef<AbortController | null>(null);
  const writing = useRef(false);

  const refresh = useCallback(async () => {
    if (reading.current || writing.current) return;
    const controller = new AbortController();
    reading.current = controller;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
      const result = await response.json() as ProjectionQueueState & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível ler a fila.');
      if (!controller.signal.aborted && !writing.current) setQueue(result);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível ler a fila.');
    } finally {
      if (reading.current === controller) reading.current = null;
    }
  }, [endpoint]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 2500);
    const focused = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', focused);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', focused);
      reading.current?.abort();
      reading.current = null;
    };
  }, [refresh]);

  async function command(action: string, values: Record<string, unknown>, feedback: string) {
    if (writing.current) return;
    reading.current?.abort();
    reading.current = null;
    writing.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json() as ProjectionQueueState & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a fila.');
      setQueue(result);
      setNotice(feedback);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar a fila.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  const prepared = queue?.items.find(item => item.id === queue.preparedId);
  const active = queue?.active;
  return (
    <section className="projection-console" aria-labelledby="projection-title">
      <header className="projection-console-head">
        <div>
          <h2 id="projection-title">Fila de projeção</h2>
          <p>Envia fotos e dedicatórias aprovadas a partir de Galeria e mural.</p>
        </div>
        <button type="button" className="studio-control" onClick={() => void refresh()} disabled={busy}>Atualizar fila</button>
      </header>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {notice && <p className="projection-feedback" role="status">{notice}</p>}
      {!queue && !error && <p>A carregar a fila…</p>}

      <div className="projection-status-grid">
        <section>
          <h3><Eye size={17} aria-hidden="true" /> Prévia</h3>
          {prepared ? <>
            <ProjectionPreview item={prepared} />
            <button className="studio-control studio-accent" type="button" disabled={busy}
              onClick={() => command('project', { id: prepared.id }, 'Projeção ativada.')}>
              <Monitor size={16} aria-hidden="true" /> Projetar por {prepared.durationSeconds} s
            </button>
          </> : <p>Seleciona «Preparar» num item da fila.</p>}
        </section>
        <section>
          <h3><Monitor size={17} aria-hidden="true" /> Em projeção</h3>
          {active ? <>
            <ProjectionPreview item={active} />
            <div className="projection-actions">
              <button className="studio-control" type="button" disabled={busy}
                onClick={() => command('return', {}, 'Projeção encerrada. O ecrã voltou à cena.')}>
                <Square size={16} aria-hidden="true" /> Voltar à cena
              </button>
              <button className="studio-control" type="button" disabled={busy || !queue?.items.length}
                onClick={() => command('skip', {}, 'Projeção encerrada. Próximo item preparado.')}>
                <SkipForward size={16} aria-hidden="true" /> Preparar próximo
              </button>
            </div>
          </> : <p>O ecrã mostra a cena atual do Estúdio.</p>}
        </section>
      </div>

      {queue?.items.length ? (
        <ol className="projection-items">
          {queue.items.map((item, index) => (
            <li key={item.id} data-prepared={prepared?.id === item.id}>
              <div className="projection-item-info">
                <b>{item.title}</b>
                <span>{item.kind === 'messages' ? 'Dedicatória' : item.mime?.startsWith('video/') ? 'Vídeo' : 'Fotografia'}
                  {prepared?.id === item.id ? ' · Preparado' : ''}</span>
              </div>
              <div className="projection-actions">
                <label>Duração
                  <select aria-label={`Duração de ${item.title}`} value={item.durationSeconds} disabled={busy}
                    onChange={event => command('duration', { id: item.id, durationSeconds: Number(event.target.value) }, 'Duração atualizada.')}>
                    {[...new Set([...durationChoices, item.durationSeconds])].sort((a, b) => a - b)
                      .map(seconds => <option key={seconds} value={seconds}>{seconds} s</option>)}
                  </select>
                </label>
                <button type="button" className="studio-control" disabled={busy || index === 0}
                  aria-label={`Subir ${item.title}`} onClick={() => command('move', { id: item.id, direction: 'up' }, 'Ordem atualizada.')}>
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button type="button" className="studio-control" disabled={busy || index === queue.items.length - 1}
                  aria-label={`Descer ${item.title}`} onClick={() => command('move', { id: item.id, direction: 'down' }, 'Ordem atualizada.')}>
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className="studio-control" disabled={busy || item.id === prepared?.id}
                  onClick={() => command('prepare', { id: item.id }, 'Item preparado para prévia.')}>Preparar</button>
                <button type="button" className="studio-control" disabled={busy} aria-label={`Remover ${item.title} da fila`}
                  onClick={() => command('remove', { id: item.id }, 'Item retirado da fila.')}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : queue && <p className="projection-empty">A fila está vazia.</p>}
    </section>
  );
}
