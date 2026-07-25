import { NextRequest, NextResponse } from 'next/server';
import { generateFinalSummaries } from '@/lib/extract';
import { buildLiveMeetingInsights, LiveTranscriptEntry } from '@/lib/liveMeeting';
import {
  addAiActivity,
  addMemoryNote,
  addParticipant,
  appendTranscriptAndInsights,
  getLiveMeeting,
  setFinalSummaries,
  updateLiveMeetingStatus,
} from '@/lib/liveMeetingStore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await params;
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    const speaker = typeof body?.speaker === 'string' && body.speaker.trim() ? body.speaker.trim() : 'Participant';
    const clientTimestamp = typeof body?.timestamp === 'string' ? body.timestamp : undefined;

    if (!text) {
      return NextResponse.json({ error: 'No transcript text provided' }, { status: 400 });
    }

    const existing = getLiveMeeting(meetingId);
    if (!existing) {
      return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });
    }

    // Guard against duplicate transcript entries (e.g. a retried request or a
    // speech-recognition restart re-emitting the same final utterance).
    const lastEntry = existing.transcriptEntries[existing.transcriptEntries.length - 1];
    if (lastEntry && lastEntry.text.trim().toLowerCase() === text.toLowerCase() && lastEntry.speaker === speaker) {
      return NextResponse.json({ meeting: existing, duplicate: true });
    }

    const entry: LiveTranscriptEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      speaker,
      text,
      timestamp: clientTimestamp || new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    // Fast, local, incremental insight extraction — no external API calls, so
    // this stays responsive even for very long meetings with frequent updates.
    const mergedEntries = [...existing.transcriptEntries, entry];
    const insights = buildLiveMeetingInsights(mergedEntries);
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

    if (action === 'end' || action === 'finalize' || action === 'summarize') {
      // 'summarize' generates an on-demand Executive/Technical/Minutes preview
      // mid-meeting without ending the session; 'end'/'finalize' does the same
      // but also marks the session as ended (playback finished).
      let meeting = action === 'summarize' ? getLiveMeeting(meetingId) : updateLiveMeetingStatus(meetingId, 'ended');
      if (!meeting) return NextResponse.json({ error: 'Live meeting not found' }, { status: 404 });

      const finalSummaries = await generateFinalSummaries(meeting.transcriptText);
      const withSummaries = setFinalSummaries(meetingId, finalSummaries);
      addAiActivity(meetingId, action === 'summarize'
        ? 'Generated an on-demand executive/technical/minutes summary preview.'
        : 'Generated final executive, technical, and minutes summaries.');

      return NextResponse.json({ meeting: withSummaries || meeting });
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
