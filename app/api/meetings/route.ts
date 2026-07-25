import { NextResponse } from 'next/server';
import { getMeetings } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    const userId = user?.userId || (user as any)?.id || 'demo-user';

    const meetings = await getMeetings(userId);
    const demoMeetings = userId !== 'demo-user' ? await getMeetings('demo-user') : [];

    const combinedMap = new Map();
    [...meetings, ...demoMeetings].forEach((m) => combinedMap.set(m.id, m));
    const uniqueMeetings = Array.from(combinedMap.values());

    const sorted = uniqueMeetings.sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Failed to get meetings:', error);
    return NextResponse.json({ error: 'Failed to retrieve meetings' }, { status: 500 });
  }
}
