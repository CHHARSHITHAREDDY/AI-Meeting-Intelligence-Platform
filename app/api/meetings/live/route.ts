import { NextRequest, NextResponse } from 'next/server';
import { saveMeeting } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, hostName, meetingId, participantName, transcript, insights } = body;

    if (action === 'create') {
      const id = `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newMeeting = {
        id,
        title: title || 'Live Call',
        hostName: hostName || 'Host',
        status: 'live',
        participants: [hostName || 'Host'],
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, meeting: newMeeting });
    }

    if (action === 'join') {
      const id = meetingId || `live-${Date.now()}`;
      const joinedMeeting = {
        id,
        title: title || 'Live Call',
        status: 'live',
        participants: [participantName || 'Guest'],
      };
      return NextResponse.json({ success: true, meeting: joinedMeeting });
    }

    if (action === 'start') {
      return NextResponse.json({ success: true, status: 'live' });
    }

    if (action === 'end') {
      if (meetingId && transcript && transcript.length > 0) {
        const fullTranscript = transcript.map((t: any) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n');
        await saveMeeting({
          id: meetingId,
          title: title || 'Live Call Session',
          date: new Date().toISOString(),
          duration: `${Math.max(1, Math.floor(transcript.length / 2))}m`,
          transcript: fullTranscript,
          status: 'completed',
          analysis: {
            summary: insights?.summary || 'Live meeting session completed with real-time AI transcription.',
            decisions: insights?.decisions?.map((d: any) => ({
              id: d.id,
              decision: d.detail || d.title,
              decider: hostName || 'Host',
              context: 'Agreed during live session',
            })) || [],
            actionItems: insights?.actionItems?.map((a: any) => ({
              id: a.id,
              task: a.detail || a.title,
              assignee: a.assignee || hostName || 'Host',
              dueDate: 'TBD',
              status: 'pending',
            })) || [],
            risks: insights?.risks?.map((r: any) => ({
              id: r.id || `risk-${Date.now()}`,
              risk: r.detail || r.title,
              impact: 'medium',
              mitigation: 'Monitor in next sprint',
            })) || [],
          }
        }, fullTranscript);
      }
      return NextResponse.json({ success: true, status: 'ended' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
