import { isEventAdmin } from '../lib/auth';

export async function isAdmin(slug = 'emerson', permission = 'event:manage'): Promise<boolean> {
  return await isEventAdmin(slug, permission);
}
