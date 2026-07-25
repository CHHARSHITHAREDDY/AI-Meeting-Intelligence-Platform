import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, getMeetingsByProject } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { answerProjectQuestion } from '@/lib/projectIntelligence';

// Project-level "Ask AI" — answers questions grounded in every meeting
// belonging to this project, not just one.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectById(id, user.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const meetings = await getMeetingsByProject(id, user.userId);
    const reply = await answerProjectQuestion(meetings, message);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Projects API] Failed to answer project question:', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}
