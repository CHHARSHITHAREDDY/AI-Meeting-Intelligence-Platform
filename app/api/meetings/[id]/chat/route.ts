import { NextRequest, NextResponse } from 'next/server';
import { getMeetingById } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(
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
    const { message, chatHistory } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { generateGroundedRAGAnswer } = require('@/lib/rag');
    const reply = await generateGroundedRAGAnswer(message, meeting, chatHistory || []);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Chat Route] General error:', error);
    return NextResponse.json({ error: 'Failed to process chat: ' + error.message }, { status: 500 });
  }
}
