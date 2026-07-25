import { NextRequest, NextResponse } from 'next/server';
import { saveMeeting } from '@/lib/db';

// In-memory store for active live rooms
const roomsStore = new Map<string, {
  id: string;
  title: string;
  hostName: string;
  status: 'scheduled' | 'live' | 'ended';
  participants: string[];
  createdAt: string;
  transcript?: any[];
  insights?: any;
}>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, title, hostName, meetingId, participantName, transcript, insights } = body;

    if (action === 'create') {
      const id = `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newRoom = {
        id,
        title: title || 'Live Call',
        hostName: hostName || 'Host',
        status: 'live' as const,
        participants: [hostName || 'Host'],
        createdAt: new Date().toISOString(),
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
          status: 'live' as const,
          participants: [participantName || 'Guest'],
          createdAt: new Date().toISOString(),
        };
        roomsStore.set(id, room);
      } else {
        const guestName = participantName || 'Guest';
        if (!room.participants.includes(guestName)) {
          room.participants.push(guestName);
        }
      }
      return NextResponse.json({ success: true, meeting: room });
    }

    if (action === 'start') {
      if (meetingId) {
        const room = roomsStore.get(meetingId);
        if (room) room.status = 'live';
      }
      return NextResponse.json({ success: true, status: 'live' });
    }

    if (action === 'update_sync') {
      if (meetingId) {
        const room = roomsStore.get(meetingId);
        if (room) {
          if (transcript) room.transcript = transcript;
          if (insights) room.insights = insights;
          return NextResponse.json({ success: true, meeting: room });
        }
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
          const fullTranscript = transcript.map((t: any) => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n');
          await saveMeeting({
            id: meetingId,
            title: title || room?.title || 'Live Call Session',
            date: new Date().toISOString(),
            duration: `${Math.max(1, Math.floor(transcript.length / 2))}m`,
            transcript: fullTranscript,
            status: 'completed',
            analysis: {
              summary: insights?.summary || 'Live meeting session completed with multi-participant real-time WebRTC audio & video.',
              decisions: insights?.decisions?.map((d: any) => ({
                id: d.id,
                decision: d.detail || d.title,
                decider: hostName || 'Host',
                context: 'Agreed in live call',
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
      }
      return NextResponse.json({ success: true, status: 'ended' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
