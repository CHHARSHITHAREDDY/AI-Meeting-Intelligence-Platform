import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects, getMeetingsByProject } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await getProjects(user.userId);
    // Attach a lightweight meeting count per project for the list view.
    const withCounts = await Promise.all(
      projects.map(async (p) => {
        const meetings = await getMeetingsByProject(p.id, user.userId);
        return { ...p, meetingCount: meetings.length };
      })
    );

    return NextResponse.json(withCounts);
  } catch (error: any) {
    console.error('[Projects API] Failed to list projects:', error);
    return NextResponse.json({ error: 'Failed to retrieve projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const id = 'proj_' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const project = await createProject(id, name, description, user.userId);

    return NextResponse.json(project);
  } catch (error: any) {
    console.error('[Projects API] Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
