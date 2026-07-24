import { NextRequest, NextResponse } from 'next/server';
import { createLiveMeeting, listLiveMeetings } from '@/lib/liveMeetingStore';

export async function GET() {
  return NextResponse.json({ meetings: listLiveMeetings() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : 'Live AI Meeting';
    const hostName = typeof body?.hostName === 'string' ? body.hostName.trim() : 'Host';

    const meeting = createLiveMeeting(title, hostName);
    return NextResponse.json({ meeting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create live meeting' }, { status: 500 });
  }
}
