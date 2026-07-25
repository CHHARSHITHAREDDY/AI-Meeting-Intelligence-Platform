import { NextRequest, NextResponse } from 'next/server';
import { answerLiveMeetingQuestion } from '@/lib/liveChat';
import { addAiActivity, getLiveMeeting } from '@/lib/liveMeetingStore';

// Chat endpoint for the browser extension / live dashboard: answers questions
// grounded ONLY in the processed transcript + extracted insights of a live
// (in-memory) meeting session. No auth required — mirrors the rest of the
// unauthenticated /api/live-meetings surface used by the extension.
export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const meeting = getLiveMeeting(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
    }

    const reply = await answerLiveMeetingQuestion(meeting, message);
    addAiActivity(meetingId, `Answered a chat question: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Live Chat API] failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to process chat message' }, { status: 500 });
  }
}
