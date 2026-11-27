export type ProjectionKind = 'photos' | 'messages';

export type ProjectionContent = {
  id: number;
  kind: ProjectionKind;
  title: string;
  text: string;
  mediaUrl: string | null;
  mime: string | null;
};

export type ProjectionItem = ProjectionContent & { durationSeconds: number };
export type ActiveProjection = ProjectionItem & { expiresAt: number };

export type ProjectionQueueState = {
  items: ProjectionItem[];
  preparedId: number | null;
  active: ActiveProjection | null;
  timestamp: number;
};
