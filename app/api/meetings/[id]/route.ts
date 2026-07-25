import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById, saveMeeting, deleteMeeting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { regenerateProjectIntelligence } from '@/lib/projectIntelligence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await getMeetingById(id, user.userId);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Failed to get meeting:', error);
    return NextResponse.json({ error: 'Failed to retrieve meeting' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await getMeetingById(id, user.userId);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const body = await request.json();
    const previousProjectId = meeting.projectId;

    if (body.actionItems && meeting.analysis) {
      meeting.analysis.actionItems = body.actionItems;
    }
    if (body.title) {
      meeting.title = body.title;
    }
    if (typeof body.projectId === 'string') {
      // Empty string explicitly unassigns the meeting from any project.
      meeting.projectId = body.projectId || undefined;
    }
    // Calendar fields — reschedule/cancel a meeting, or edit its agenda and
    // participant list, all through this same generic PATCH.
    if (body.scheduledAt) {
      if (isNaN(new Date(body.scheduledAt).getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
      }
      meeting.scheduledAt = new Date(body.scheduledAt).toISOString();
    }
    if (typeof body.durationMinutes === 'number') {
      meeting.durationMinutes = body.durationMinutes;
    }
    if (Array.isArray(body.participants)) {
      meeting.participants = body.participants;
    }
    if (typeof body.agenda === 'string') {
      meeting.agenda = body.agenda;
    }
    if (body.priority && ['low', 'medium', 'high'].includes(body.priority)) {
      meeting.priority = body.priority;
    }
    if (body.status && ['scheduled', 'cancelled'].includes(body.status)) {
      // Only allow manual transitions between the two calendar-only
      // statuses here — the pipeline statuses (processing/completed/
      // failed/live) are exclusively managed by the upload/live-meeting
      // routes and must not be settable through this generic PATCH.
      meeting.status = body.status;
    }

    await saveMeeting(meeting, user.userId);

    // Keep affected projects' AI summary/progress/flow in sync — non-blocking
    // so this request doesn't wait on an LLM round-trip.
    const affectedProjectIds = new Set([previousProjectId, meeting.projectId].filter(Boolean) as string[]);
    affectedProjectIds.forEach((projectId) => {
      regenerateProjectIntelligence(projectId, user.userId).catch((err) =>
        console.error(`[Meetings API] Failed to refresh project ${projectId} after meeting update:`, err.message)
      );
    });

    return NextResponse.json(meeting);
  } catch (error) {
    console.error('Failed to update meeting:', error);
    return NextResponse.json({ error: 'Failed to update meeting' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meeting = await getMeetingById(id, user.userId);
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    await deleteMeeting(id, user.userId);

    if (meeting.projectId) {
      regenerateProjectIntelligence(meeting.projectId, user.userId).catch((err) =>
        console.error(`[Meetings API] Failed to refresh project ${meeting.projectId} after meeting delete:`, err.message)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete meeting:', error);
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
  }
}

