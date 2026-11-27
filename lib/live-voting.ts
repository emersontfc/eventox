export type LivePollStatus = 'draft' | 'open' | 'closed' | 'revealed';
export type LivePoll = {
  id: number;
  title: string;
  status: LivePollStatus;
  active: boolean;
  options: { id: number; label: string; votes: number | null }[];
  totalVotes: number | null;
};

export type GuestPoll = {
  poll: LivePoll | null;
  voters: { member: number; name: string; optionId: number | null }[];
};

export type PollCommand = 'open' | 'close' | 'reveal' | 'project' | 'delete';

export const pollStatusLabels: Record<LivePollStatus, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  closed: 'Encerrada',
  revealed: 'Resultados publicados',
};
