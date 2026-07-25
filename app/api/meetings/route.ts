import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, getMeetingsByDateRange, saveMeeting, Meeting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    // Calendar month/week/day views pass a date range; every other existing
    // caller omits it and gets the exact same full list as before.
    if (start && end) {
      const meetings = await getMeetingsByDateRange(user.userId, start, end);
      return NextResponse.json(meetings);
    }

    const meetings = await getMeetings(user.userId);
    // Sort meetings by date (newest first)
    const sorted = [...meetings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return NextResponse.json(sorted);
  } catch (error) {
    console.error('Failed to get meetings:', error);
    return NextResponse.json({ error: 'Failed to retrieve meetings' }, { status: 500 });
  }
}

// Creates a scheduled meeting shell — a real calendar event that doesn't
// have a recording/transcript yet. Uploading against its id later (see
// app/api/upload/route.ts's meetingId handling) attaches the recording to
// this same row instead of creating a duplicate meeting.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, scheduledAt, durationMinutes, participants, agenda, priority, projectId } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
      return NextResponse.json({ error: 'A valid scheduledAt date is required' }, { status: 400 });
    }
    if (participants !== undefined && !Array.isArray(participants)) {
      return NextResponse.json({ error: 'participants must be an array' }, { status: 400 });
    }
    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
      return NextResponse.json({ error: 'priority must be low, medium, or high' }, { status: 400 });
    }

    const id = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const meeting: Meeting = {
      id,
      title: title.trim(),
      date: new Date(scheduledAt).toISOString(),
      duration: '',
      transcript: '',
      status: 'scheduled',
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : undefined,
      participants: participants || undefined,
      agenda: agenda || undefined,
      priority: priority || undefined,
      projectId: projectId || undefined,
    };

    await saveMeeting(meeting, user.userId);
    return NextResponse.json(meeting, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create scheduled meeting:', error);
    return NextResponse.json({ error: 'Failed to create scheduled meeting' }, { status: 500 });
  }
}

