import type { ProgramItem } from './event-program';
import type { PublicLiveProgram } from './live-program';

export type GuestInvitationData = {
  title: string;
  hostName: string;
  venue: string;
  coverTheme: string;
  startsAt: string | null;
  opensAt: string | null;
  dayOpen: boolean;
  eventSlug: string | null;
  photoAlbumUrl: string | null;
  liveProgram: PublicLiveProgram | null;
  members: {
    name: string;
    status: string;
    seat: { tableName: string; tableNumber: number; number: number } | null;
  }[];
  program: ProgramItem[];
  menu: { id: number; name: string; description: string; category: string; unit: string }[];
};

export const INVITE_TIME_ZONE = 'Africa/Maputo';

export function invitationDates(eventDate: string, now = Date.now()) {
  const date = eventDate.trim();
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(date);
  const start = new Date(local ? `${date}+02:00` : date);
  if (!Number.isFinite(start.getTime())) return { startsAt: null, opensAt: null, dayOpen: false };

  const isoDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: INVITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(start);
  const opens = new Date(`${isoDate}T00:00:00+02:00`);
  return { startsAt: start.toISOString(), opensAt: opens.toISOString(), dayOpen: now >= opens.getTime() };
}
