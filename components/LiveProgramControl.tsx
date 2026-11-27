'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { OperatorLiveProgram } from '../lib/live-program';
import LiveProgramHighlights from './LiveProgramHighlights';
import styles from './live-program.module.css';

export default function LiveProgramControl({ slug }: { slug: string }) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/live-program`;
  const [state, setState] = useState<OperatorLiveProgram | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reading = useRef<AbortController | null>(null);
  const writing = useRef(false);

  const refresh = useCallback(async (showError = false) => {
    if (writing.current || reading.current) return;
    const controller = new AbortController();
    reading.current = controller;
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Não foi possível carregar o programa ao vivo.');
      const result = await response.json() as OperatorLiveProgram;
      if (!controller.signal.aborted) setState(result);
      if (showError) setError('');
    } catch (failure) {
      if (showError && !controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o programa.');
      }
    } finally {
      if (reading.current === controller) reading.current = null;
    }
  }, [endpoint]);

  useEffect(() => {
    setState(null);
    void refresh(true);
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(check, 6000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      reading.current?.abort();
      reading.current = null;
    };
  }, [refresh]);

  async function apply(type: 'select' | 'advance' | 'complete' | 'reset', index?: number) {
    if (!state || writing.current) return;
    writing.current = true;
    reading.current?.abort();
    reading.current = null;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, index, revision: state.revision }),
      });
      if (!response.ok) {
        const result = await response.json() as { state?: OperatorLiveProgram; error?: string };
        if (result.state) setState(result.state);
        throw new Error(result.error || 'Não foi possível atualizar o programa.');
      }
      setState(await response.json() as OperatorLiveProgram);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o programa.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return (
    <section className={styles.control} aria-labelledby="live-program-heading">
      <header className={styles.header}>
        <div>
          <h2 id="live-program-heading"><CalendarDays size={21} aria-hidden="true" /> Programa ao vivo</h2>
          <p>Atualiza o momento que os convidados veem como Agora.</p>
        </div>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => void refresh(true)}>Atualizar</button>
      </header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!state && !error && <p role="status">A carregar o programa…</p>}
      {state && (
        <>
          <LiveProgramHighlights state={state} dark />
          {state.needsSelection && <p className={styles.error} role="status">O momento em curso foi alterado no programa. Seleciona o momento atual.</p>}
          {!state.program.length ? (
            <p>Publica os momentos na secção Programa para os acompanhar durante a gala.</p>
          ) : (
            <>
              <div className={styles.actions}>
                {state.next && (
                  <button type="button" className={styles.primary} disabled={busy} onClick={() => void apply('advance')}>
                    {state.status === 'ready' ? 'Iniciar programa' : 'Avançar para o próximo'}
                  </button>
                )}
                {state.status === 'live' && !state.next && !state.needsSelection && (
                  <button type="button" className={styles.primary} disabled={busy} onClick={() => void apply('complete')}>Concluir programa</button>
                )}
                {state.status === 'complete' && (
                  <button type="button" className={styles.secondary} disabled={busy} onClick={() => void apply('reset')}>Voltar ao início</button>
                )}
              </div>
              <ol className={styles.program}>
                {state.program.map((item, index) => (
                  <li key={index} className={index === state.currentIndex ? styles.selected : ''}>
                    <time dateTime={item.time} title="Hora prevista">{item.time}</time>
                    <div>
                      <strong>{item.title}</strong>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    {index === state.currentIndex ? <span className={styles.badge}>Em curso</span> : (
                      <button type="button" className={styles.secondary} disabled={busy}
                        aria-label={`Definir como atual: ${item.title}`} onClick={() => void apply('select', index)}>Definir como atual</button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  );
}
