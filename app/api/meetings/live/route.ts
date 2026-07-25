import { NextRequest, NextResponse } from 'next/server';
import { saveMeeting } from '@/lib/db';

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

// In-memory global store for active LiveKit / WebRTC rooms across tabs & browsers
const globalLiveRooms = globalThis as unknown as {
  liveRoomsStore?: Map<string, LiveRoom>;
};

if (!globalLiveRooms.liveRoomsStore) {
  globalLiveRooms.liveRoomsStore = new Map<string, LiveRoom>();
}

const roomsStore = globalLiveRooms.liveRoomsStore;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get('meetingId');

  if (!meetingId) {
    return NextResponse.json({ rooms: Array.from(roomsStore.values()) });
  }

  const room = roomsStore.get(meetingId);
  if (!room) {
    // Return default active room structure if missing
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
            participants: room?.participants || [hostName || 'Host'],
            summary: insights?.summary || 'Live meeting session completed with multi-participant real-time WebRTC audio & video.',
            decisions: insights?.decisions?.map((d: any) => ({
              id: d.id,
              decision: d.detail || d.title,
              decider: hostName || 'Host',
              impact: 'high',
            })) || [],
            actionItems: insights?.actionItems?.map((a: any) => ({
              id: a.id,
              task: a.detail || a.title,
              assignee: a.assignee || hostName || 'Host',
              priority: 'high',
              status: 'pending',
            })) || [],
            risks: insights?.risks?.map((r: any) => ({
              risk: r.detail || r.title,
              impact: 'medium',
              mitigation: 'Monitor in next sprint',
            })) || [],
            notes: [fullTranscript],
          });
        }
      }
      return NextResponse.json({ success: true, status: 'ended' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
