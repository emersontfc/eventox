import type { ProgramItem } from './event-program';

export type PublicLiveProgram = {
  status: 'ready' | 'live' | 'complete';
  current: ProgramItem | null;
  next: ProgramItem | null;
  startedAt: string | null;
};

export type OperatorLiveProgram = PublicLiveProgram & {
  program: ProgramItem[];
  currentIndex: number | null;
  needsSelection: boolean;
  revision: string;
};
