import { getChatGPTUser } from './chatgpt-auth';
import AdminDashboard from './AdminDashboard';
import Gallery from './Gallery';
import { isAdminUser } from './admin-auth';

export const dynamic='force-dynamic';
export default async function Home(){
  const user=await getChatGPTUser();
  return isAdminUser(user)?<AdminDashboard/>:<Gallery/>;
}
