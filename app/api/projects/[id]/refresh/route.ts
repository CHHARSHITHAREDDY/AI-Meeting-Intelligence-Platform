import { NextRequest, NextResponse } from 'next/server';
import { getProjectById } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { regenerateProjectIntelligence } from '@/lib/projectIntelligence';

// Regenerates the AI Project Summary, Progress, and Project Flow from every
// meeting currently in the project. This also runs automatically after each
// meeting upload (see app/api/upload/route.ts) — this endpoint exists so the
// UI can offer an on-demand "Refresh" action too.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getProjectById(id, user.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await regenerateProjectIntelligence(id, user.userId);
    const updated = await getProjectById(id, user.userId);

    return NextResponse.json({ project: updated });
  } catch (error: any) {
    console.error('[Projects API] Failed to refresh project intelligence:', error);
    return NextResponse.json({ error: 'Failed to refresh project intelligence' }, { status: 500 });
  }
}
