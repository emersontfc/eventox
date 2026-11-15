import { getChatGPTUser, type ChatGPTUser } from './chatgpt-auth';

const ownerEmail='emersontorres42@gmail.com';
export function isAdminUser(user:ChatGPTUser|null){return Boolean(user?.email&&user.email.toLowerCase()===ownerEmail)}
export async function isAdmin(){return isAdminUser(await getChatGPTUser())}
