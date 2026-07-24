import { NextRequest, NextResponse } from 'next/server';
import { getLiveMeetingPublicInfo } from '@/lib/liveMeetingStore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const info = getLiveMeetingPublicInfo(meetingId);

    if (!info) {
      return NextResponse.json({ error: 'Meeting link invalid or expired' }, { status: 404 });
    }

    return NextResponse.json({ meeting: info });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to retrieve meeting information' }, { status: 500 });
  }
}
