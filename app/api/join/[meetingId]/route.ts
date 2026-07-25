import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    const meeting = {
      id: meetingId,
      title: 'Live WebRTC Call Session',
      hostName: 'Meeting Host',
      status: 'live',
      participantCount: 1,
      participants: ['Host'],
    };

    return NextResponse.json({ success: true, meeting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Meeting info unavailable' }, { status: 500 });
  }
}
