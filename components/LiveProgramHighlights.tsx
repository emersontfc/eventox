import type { PublicLiveProgram } from '../lib/live-program';
import styles from './live-program.module.css';

const actualTime = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Africa/Maputo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export default function LiveProgramHighlights({ state, dark = false }: { state: PublicLiveProgram; dark?: boolean }) {
  if (!state.current && !state.next && state.status !== 'complete') return null;

  if (state.status === 'complete') {
    return <p className={dark ? `${styles.completed} ${styles.dark}` : styles.completed} role="status">Programa concluído.</p>;
  }

  return (
    <div className={dark ? `${styles.highlights} ${styles.dark}` : styles.highlights} aria-live="polite">
      {state.current && (
        <section className={styles.current}>
          <span className={styles.momentLabel}>Agora</span>
          <strong>{state.current.title}</strong>
          {state.startedAt && <time dateTime={state.startedAt}>Em curso desde as {actualTime.format(new Date(state.startedAt))}</time>}
          {state.current.description && <p>{state.current.description}</p>}
        </section>
      )}
      {state.next && (
        <section className={styles.next}>
          <span className={styles.momentLabel}>A seguir</span>
          <strong>{state.next.title}</strong>
          {state.next.description && <p>{state.next.description}</p>}
        </section>
      )}
    </div>
  );
}
