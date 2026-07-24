import { NextResponse } from 'next/server';
import { getMeetings } from '@/lib/db';

export async function GET() {
  try {
    const meetings = await getMeetings();
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
