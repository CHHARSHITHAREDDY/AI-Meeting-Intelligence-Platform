import { NextResponse } from 'next/server';
import { getMeetings } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const meetings = await getMeetings(user.userId);
    // Sort meetings by date (newest first)
    const sorted = [...meetings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Failed to get meetings:', error);
    return NextResponse.json({ error: 'Failed to retrieve meetings' }, { status: 500 });
  }
}

