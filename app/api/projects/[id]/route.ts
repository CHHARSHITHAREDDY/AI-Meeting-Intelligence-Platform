import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, deleteProject, getMeetingsByProject } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const meetings = await getMeetingsByProject(id, user.userId);
    return NextResponse.json({ project, meetings });
  } catch (error: any) {
    console.error('[Projects API] Failed to get project:', error);
    return NextResponse.json({ error: 'Failed to retrieve project' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Meetings are unassigned (project_id -> NULL via ON DELETE SET NULL),
    // not deleted — deleting a project shouldn't destroy meeting recordings.
    await deleteProject(id, user.userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Projects API] Failed to delete project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
