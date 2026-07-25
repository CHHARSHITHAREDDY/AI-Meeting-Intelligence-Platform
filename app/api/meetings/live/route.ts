import { NextRequest, NextResponse } from 'next/server';
import { saveMeeting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

interface LiveRoom {
  id: string;
  title: string;
  hostName: string;
  status: 'scheduled' | 'live' | 'ended';
  participants: string[];
  createdAt: string;
  transcript: any[];
  insights: any;
}

// In-memory store for active live rooms
const roomsStore = new Map<string, LiveRoom>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get('meetingId');

  if (!meetingId) {
    return NextResponse.json({ rooms: Array.from(roomsStore.values()) });
  }

  const room = roomsStore.get(meetingId);
  if (!room) {
    return NextResponse.json({
      success: true,
      meeting: {
        id: meetingId,
        title: 'Live WebRTC Call',
        hostName: 'Host',
        status: 'live',
        participants: ['Host'],
        transcript: [],
        insights: { summary: '', decisions: [], actionItems: [], risks: [] },
      },
    });
  }

  return NextResponse.json({ success: true, meeting: room });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, hostName, meetingId, participantName, transcript, insights } = body;
    const user = await getSessionUser();
    const userId = user?.userId || (user as any)?.id || 'demo-user';

    if (action === 'create') {
      const id = meetingId || `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newRoom: LiveRoom = {
        id,
        title: title || 'Live Call',
        hostName: hostName || 'Host',
        status: 'live',
        participants: [hostName || 'Host'],
        createdAt: new Date().toISOString(),
        transcript: transcript || [],
        insights: insights || { summary: '', decisions: [], actionItems: [], risks: [] },
      };

      roomsStore.set(id, newRoom);
      return NextResponse.json({ success: true, meeting: newRoom });
    }

    if (action === 'join') {
      const id = meetingId || `live-${Date.now()}`;
      let room = roomsStore.get(id);

      if (!room) {
        room = {
          id,
          title: title || 'Live Call',
          hostName: 'Host',
          status: 'live',
          participants: [],
          createdAt: new Date().toISOString(),
          transcript: [],
          insights: { summary: '', decisions: [], actionItems: [], risks: [] },
        };
        roomsStore.set(id, room);
      }

      const pName = participantName || 'Guest Participant';
      if (!room.participants.includes(pName)) {
        room.participants.push(pName);
      }

      return NextResponse.json({ success: true, meeting: room });
    }

    if (action === 'sync') {
      if (meetingId && roomsStore.has(meetingId)) {
        const room = roomsStore.get(meetingId)!;
        if (transcript) room.transcript = transcript;
        if (insights) room.insights = insights;
        return NextResponse.json({ success: true, meeting: room });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'end') {
      if (meetingId) {
        const room = roomsStore.get(meetingId);
        if (room) {
          room.status = 'ended';
        }

        if (transcript && transcript.length > 0) {
          const fullTranscript = transcript.map((t: any) => `[${t.timestamp || '00:00'}] ${t.speaker || 'Participant'}: ${t.text}`).join('\n');
          
          const formattedDecisions = (insights?.decisions || []).map((d: any, idx: number) => ({
            id: d.id || `dec-${idx + 1}`,
            decision: d.decision || d.detail || d.title || 'Live Decision',
            decider: hostName || 'Host',
            context: 'Agreed in live meeting',
          }));

          const formattedActionItems = (insights?.actionItems || []).map((a: any, idx: number) => ({
            id: a.id || `act-${idx + 1}`,
            task: a.task || a.detail || a.title || 'Live Task Item',
            assignee: a.assignee || hostName || 'Team',
            dueDate: a.dueDate || 'TBD',
            status: a.status || 'pending',
          }));

          const formattedRisks = (insights?.risks || []).map((r: any, idx: number) => ({
            id: r.id || `risk-${idx + 1}`,
            risk: r.risk || r.detail || r.title || 'Live Risk',
            impact: r.severity || r.impact || 'medium',
            mitigation: r.mitigation || 'Monitor closely',
          }));

          await saveMeeting({
            id: meetingId,
            title: title || room?.title || 'Live Call Session',
            date: new Date().toISOString(),
            duration: `${Math.max(1, Math.floor(transcript.length / 2))}m`,
            transcript: fullTranscript,
            status: 'completed',
            analysis: {
              summary: insights?.summary || 'Live meeting session completed with real-time AI transcription.',
              decisions: formattedDecisions,
              actionItems: formattedActionItems,
              risks: formattedRisks,
            }
          }, userId);
        }
      }
      return NextResponse.json({ success: true, status: 'ended' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
