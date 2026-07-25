import { NextRequest, NextResponse } from 'next/server';
import { createTask, getTasks } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Tasks are an independent, cross-meeting entity — this is the resource
// that powers the Tasks Register, Calendar, Dashboard Daily Brief, and the
// AI Copilot's task lookups, in addition to whatever a meeting's own
// analysis.actionItems already shows on its own workspace page.
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    if (status && !['pending', 'completed'].includes(status)) {
      return NextResponse.json({ error: 'status must be pending or completed' }, { status: 400 });
    }

    const tasks = await getTasks(user.userId, {
      status: status as 'pending' | 'completed' | undefined,
      projectId: searchParams.get('projectId') || undefined,
      meetingId: searchParams.get('meetingId') || undefined,
      dueBefore: searchParams.get('dueBefore') || undefined,
      dueAfter: searchParams.get('dueAfter') || undefined,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to get tasks:', error);
    return NextResponse.json({ error: 'Failed to retrieve tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, assignee, priority, dueDate, meetingId, projectId } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
      return NextResponse.json({ error: 'priority must be low, medium, or high' }, { status: 400 });
    }
    if (dueDate !== undefined && isNaN(new Date(dueDate).getTime())) {
      return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 });
    }

    const id = 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const task = await createTask({
      id,
      userId: user.userId,
      meetingId: meetingId || undefined,
      projectId: projectId || undefined,
      title: title.trim(),
      description: description || undefined,
      assignee: assignee || 'Unassigned',
      priority: priority || 'medium',
      dueDate: dueDate || undefined,
      createdFrom: 'manual',
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
