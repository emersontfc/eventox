import { NextResponse } from 'next/server';
import { isEventAdmin } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || 'emerson';
  const authenticated = await isEventAdmin(slug);
  return NextResponse.json({ authenticated, slug });
}
