import './projection.css';
import type { ProjectionContent } from '@/lib/projection';

export default function ProjectionPreview({ item, live = false }: { item: ProjectionContent; live?: boolean }) {
  const video = item.mime?.startsWith('video/');
  return (
    <div className={live ? 'projection-live-preview' : 'projection-operator-preview'}
      data-long-text={item.text.length > 220} data-with-photo={item.kind === 'messages' && Boolean(item.mediaUrl)}>
      {item.mediaUrl && (video
        ? <video key={item.id} src={item.mediaUrl} muted autoPlay={live} loop={live} controls={!live} playsInline
            preload={live ? 'auto' : 'metadata'} aria-label={item.title} />
        : <img src={item.mediaUrl} alt={item.kind === 'messages' ? `Fotografia da dedicatória de ${item.title}` : `Imagem de ${item.title}`} />
      )}
      {item.kind === 'messages' && <figure>
        <blockquote>{item.text}</blockquote>
        <figcaption>{item.title}</figcaption>
      </figure>}
      {item.kind === 'photos' && !live && <p>{item.title}</p>}
    </div>
  );
}
