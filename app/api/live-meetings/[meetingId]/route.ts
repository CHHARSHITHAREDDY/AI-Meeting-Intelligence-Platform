import { NextRequest, NextResponse } from 'next/server';
import { extractMeetingInsights } from '@/lib/extract';
import { LiveMeetingInsights, LiveTranscriptEntry } from '@/lib/liveMeeting';
import { addAiActivity, addMemoryNote, addParticipant, appendTranscriptAndInsights, getLiveMeeting, updateLiveMeetingStatus } from '@/lib/liveMeetingStore';

function toLiveInsights(analysis: any): LiveMeetingInsights {
  return {
    summary: analysis.summary || 'Live meeting summary is being generated.',
    decisions: (analysis.decisions || []).map((item: any, index: number) => ({
      id: item.id || `decision-${index + 1}`,
      title: item.decision || item.title || 'Decision captured',
      detail: item.context || item.detail || 'Captured during the live meeting.',
    })),
    actionItems: (analysis.actionItems || []).map((item: any, index: number) => ({
      id: item.id || `action-${index + 1}`,
      title: item.task || item.title || 'Action item captured',
      detail: item.assignee ? `Assigned to ${item.assignee}` : 'Assigned during the live meeting.',
      assignee: item.assignee,
      dueDate: item.dueDate,
    })),
    risks: (analysis.risks || []).map((item: any, index: number) => ({
      id: item.id || `risk-${index + 1}`,
      title: item.risk || item.title || 'Risk captured',
      detail: item.mitigation || item.detail || 'Risk flagged during the live meeting.',
    })),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const speaker = typeof body?.speaker === 'string' && body.speaker.trim() ? body.speaker.trim() : 'Participant';

    if (!text) {
      return NextResponse.json({ error: 'No transcript text provided' }, { status: 400 });
    }

    const existing = getLiveMeeting(meetingId);
    if (!existing) {
      return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
    }

    const entry: LiveTranscriptEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      speaker,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    const analysis = await extractMeetingInsights(`${existing.transcriptText} ${text}`);
    const insights = toLiveInsights(analysis);
    const updated = appendTranscriptAndInsights(meetingId, entry, insights);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update live meeting' }, { status: 500 });
    }

    addParticipant(meetingId, speaker);
    addAiActivity(meetingId, `Processed transcript update from ${speaker}.`);

    return NextResponse.json({ meeting: updated });
  } catch (error: any) {
    console.error('[Live Meeting API] failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to process live meeting update' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'start') {
      const meeting = updateLiveMeetingStatus(meetingId, 'live');
      if (!meeting) return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
      return NextResponse.json({ meeting });
    }

    if (action === 'end') {
      const meeting = updateLiveMeetingStatus(meetingId, 'ended');
      if (!meeting) return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
      return NextResponse.json({ meeting });
    }

    if (action === 'memory') {
      const note = typeof body?.note === 'string' ? body.note.trim() : '';
      const meeting = addMemoryNote(meetingId, note);
      if (!meeting) return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
      return NextResponse.json({ meeting });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update meeting state' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const current = getLiveMeeting(meetingId);

  if (!current) {
    return NextResponse.json({
      meetingId,
      title: 'Live AI Meeting',
      hostName: 'Host',
      joinLink: `/dashboard/live?meetingId=${meetingId}`,
      status: 'scheduled',
      transcriptEntries: [],
      transcriptText: '',
      insights: {
        summary: 'Live meeting session has not started yet.',
        decisions: [],
        actionItems: [],
        risks: [],
      },
      memory: [],
      aiActivity: [],
      participants: ['Host'],
    });
  }

  return NextResponse.json(current);
}
