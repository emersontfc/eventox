import type { ProgramItem } from '../lib/event-program';

export default function ProgramTimeline({ items }: { items: ProgramItem[] }) {
  if (!items.length) return <p className="text-center">O programa será publicado em breve.</p>;

  return (
    <ol className="timeline-list program-timeline">
      {items.map((item, index) => (
        <li className="timeline-card" key={index}>
          <time className="timeline-time-badge" dateTime={item.time}>{item.time}</time>
          <div className="timeline-info">
            <h3>{item.title}</h3>
            {item.description && <p>{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
