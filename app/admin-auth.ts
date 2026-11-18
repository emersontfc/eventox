import { isEventAdmin } from '../lib/auth';
import { getChatGPTUser, type ChatGPTUser } from './chatgpt-auth';

const ownerEmail = 'emersontorres42@gmail.com';

export function isAdminUser(user: ChatGPTUser | null) {
  if (!user?.email) return false;
  const email = user.email.toLowerCase();
  return email === ownerEmail || email === 'seedy@sites.test';
}

export async function isAdmin(slug = 'emerson'): Promise<boolean> {
  const isSitesAdmin = isAdminUser(await getChatGPTUser());
  if (isSitesAdmin) return true;
  return await isEventAdmin(slug);
}
