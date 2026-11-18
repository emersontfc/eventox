import { isEventAdmin } from '../lib/auth';

export async function isAdmin(slug = 'emerson'): Promise<boolean> {
  return await isEventAdmin(slug);
}
