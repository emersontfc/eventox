import { invitationDates } from './guest-invitation';

export const GUESTBOOK_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const GUESTBOOK_BOOK_PAGE_LIMIT = 100;

export function guestbookPhotoPath(slug: string, photo: string) {
  return `/api/events/${encodeURIComponent(slug)}/guestbook/photos/${photo}`;
}

export function guestbookPhotoKey(eventId: number, photo: string) {
  return `guestbook/${eventId}/${photo}`;
}

export function guestbookPhotoToken(slug: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const prefix = guestbookPhotoPath(slug, '');
  if (!value.startsWith(prefix)) return null;
  const photo = value.slice(prefix.length);
  return /^[a-f0-9]{32}\.(jpg|png)$/.test(photo) ? photo : null;
}

export function safeGuestbookPhoto(slug: string, value: unknown) {
  const photo = guestbookPhotoToken(slug, value);
  return photo ? guestbookPhotoPath(slug, photo) : null;
}

export function guestbookBookAvailable(eventDate: string, now = Date.now()) {
  const { opensAt } = invitationDates(eventDate, now);
  return Boolean(opensAt && now >= new Date(opensAt).getTime() + 86_400_000);
}
