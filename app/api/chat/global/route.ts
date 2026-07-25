import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, Meeting } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { retrieveContextChunks, indexMeetingContext, SemanticChunk } from '@/lib/rag';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, chatHistory } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const query = message.trim();
    const userMeetings: Meeting[] = await getMeetings(user.userId);

    // Collect all semantic chunks across all user meetings
    const allChunksWithMeeting: (SemanticChunk & { meetingTitle: string; meetingDate: string })[] = [];

    userMeetings.forEach((m) => {
      const idx = indexMeetingContext(m);
      idx.chunks.forEach((chunk) => {
        allChunksWithMeeting.push({
          ...chunk,
          meetingTitle: m.title,
          meetingDate: new Date(m.date).toLocaleDateString(),
        });
      });
    });

    // Retrieve relevant chunks across all meetings
    const retrievedChunks = retrieveContextChunks(query, allChunksWithMeeting as any, 8) as (SemanticChunk & { meetingTitle: string; meetingDate: string })[];

    // Extract structured facts across all meetings
    const structuredFacts: string[] = [];
    userMeetings.forEach((m) => {
      const a = m.analysis;
      if (!a) return;
      if (a.decisions?.length) {
        a.decisions.forEach((d) => {
          structuredFacts.push(`Meeting "${m.title}" Decision: ${d.decision} (Decider: ${d.decider})`);
        });
      }
      if (a.actionItems?.length) {
        a.actionItems.forEach((x) => {
          structuredFacts.push(`Meeting "${m.title}" Action Item: ${x.task} (Assignee: ${x.assignee}, Due: ${x.dueDate}, Status: ${x.status})`);
        });
      }
      if (a.risks?.length) {
        a.risks.forEach((r) => {
          structuredFacts.push(`Meeting "${m.title}" Risk: ${r.risk} (Impact: ${r.impact}, Mitigation: ${r.mitigation})`);
        });
      }
    });

    // Determine if query is asking about meetings vs general knowledge
    const hasMeetingContext = retrievedChunks.length > 0;

    const contextSnippet = hasMeetingContext
      ? retrievedChunks.map((c) => `[Meeting: "${c.meetingTitle}" (${c.meetingDate})] [${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n')
      : 'No direct meeting dialogue matched this specific query.';

    const factsSnippet = structuredFacts.length > 0 ? structuredFacts.slice(0, 10).join('\n') : 'None';

    const memorySnippet = Array.isArray(chatHistory)
      ? chatHistory.slice(-6).map((h: any) => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
      : '';

    const systemPrompt = `You are Weave AI, an intelligent workspace AI assistant.
You have access to all user meeting recordings, transcripts, summaries, decisions, and action items in this workspace.

INSTRUCTIONS:
1. If the user's question relates to their meetings, projects, recordings, decisions, tasks, or workspace content:
   - Ground your answer in the provided Relevant Meeting Dialogue and Structured Facts below.
   - Always cite the specific Meeting Title, Date, Speaker, and Timestamp when referencing meeting information (e.g., 'In "Sprint Sync" (Jul 25), [02:15] Speaker 1 mentioned...').
2. If the user's question is general (e.g. coding help, technical concepts, general knowledge, math, creative writing, or general advice outside of meeting recordings):
   - Answer helpfully, accurately, and thoroughly as an expert AI assistant. Do NOT reject general questions!
3. Maintain a professional, clean, markdown-formatted tone.

Structured Workspace Facts:
${factsSnippet}

Relevant Meeting Dialogue Chunks:
${contextSnippet}

Recent Chat Memory:
${memorySnippet || 'None'}`;

    const nvidiaApiKey = process.env.NVIDIA_API_KEY;
    const llamaApiKey = process.env.LLAMA_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    // 1. Try NVIDIA Nemotron API
    if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
      try {
        const client = new OpenAI({ apiKey: nvidiaApiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
        const completion = await client.chat.completions.create({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          max_tokens: 1000,
          temperature: 0.3,
        });
        const reply = completion.choices[0]?.message?.content || '';
        if (reply.trim() !== '') {
          return NextResponse.json({
            reply,
            referencedMeetings: Array.from(new Set(retrievedChunks.map((c) => c.meetingTitle))),
          });
        }
      } catch (err: any) {
        console.warn('[Global Chat] NVIDIA Nemotron API notice:', err.message);
      }
    }

    // 2. Try LlamaCloud API (llx- keys) or Llama API
    if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
      try {
        if (llamaApiKey.startsWith('llx-')) {
          const { runLlamaCloudExtraction } = require('@/lib/llamaCloud');
          const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] };
          const llamaCloudRes = await runLlamaCloudExtraction(
            `${systemPrompt}\n\nUser Question: ${query}`,
            schema
          );
          if (llamaCloudRes?.answer && llamaCloudRes.answer.trim() !== '') {
            return NextResponse.json({
              reply: llamaCloudRes.answer.trim(),
              referencedMeetings: Array.from(new Set(retrievedChunks.map((c) => c.meetingTitle))),
            });
          }
        } else {
          const client = new OpenAI({ apiKey: llamaApiKey, baseURL: 'https://api.llama-api.com' });
          const completion = await client.chat.completions.create({
            model: 'llama3.1-70b-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ],
            max_tokens: 1000,
          });
          const reply = completion.choices[0]?.message?.content || '';
          if (reply.trim() !== '') {
            return NextResponse.json({
              reply,
              referencedMeetings: Array.from(new Set(retrievedChunks.map((c) => c.meetingTitle))),
            });
          }
        }
      } catch (err: any) {
        console.warn('[Global Chat] Llama API notice:', err.message);
      }
    }

    // 3. Try Anthropic Claude API
    if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const res = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: query }],
        });
        const reply = res.content[0].type === 'text' ? res.content[0].text : '';
        if (reply.trim() !== '') {
          return NextResponse.json({
            reply,
            referencedMeetings: Array.from(new Set(retrievedChunks.map((c) => c.meetingTitle))),
          });
        }
      } catch (err: any) {
        console.warn('[Global Chat] Anthropic API error:', err.message);
      }
    }

    // 4. Smart Dynamic Fallback Generator
    const fallbackReply = generateGlobalFallbackResponse(query, userMeetings, retrievedChunks);
    return NextResponse.json({
      reply: fallbackReply,
      referencedMeetings: Array.from(new Set(retrievedChunks.map((c) => c.meetingTitle))),
    });

  } catch (error: any) {
    console.error('[Global Chat Handler] Error:', error);
    return NextResponse.json({ error: 'Failed to process global chat: ' + error.message }, { status: 500 });
  }
}

function generateGlobalFallbackResponse(
  query: string,
  userMeetings: Meeting[],
  retrievedChunks: (SemanticChunk & { meetingTitle: string; meetingDate: string })[]
): string {
  const queryLower = query.toLowerCase();

  // If query matched meeting chunks across workspace
  if (retrievedChunks.length > 0) {
    const chunkLines = retrievedChunks.slice(0, 5).map((c) => 
      `• **"${c.meetingTitle}"** [${c.timestamp}] **${c.speaker}**: "${c.text}"`
    ).join('\n\n');

    return `I searched your workspace recordings for **"${query}"**. Here are the relevant findings:\n\n${chunkLines}`;
  }

  // Cross-meeting Decisions
  if (queryLower.includes('decision') || queryLower.includes('decided')) {
    const allDecisions: string[] = [];
    userMeetings.forEach((m) => {
      if (m.analysis?.decisions) {
        m.analysis.decisions.forEach((d) => {
          allDecisions.push(`• **"${m.title}"** — ${d.decision} (Decided by: ${d.decider})`);
        });
      }
    });
    if (allDecisions.length > 0) {
      return `Here are the decisions recorded across all your meetings:\n\n${allDecisions.join('\n')}`;
    }
  }

  // Cross-meeting Action Items
  if (queryLower.includes('action') || queryLower.includes('task') || queryLower.includes('assign')) {
    const allTasks: string[] = [];
    userMeetings.forEach((m) => {
      if (m.analysis?.actionItems) {
        m.analysis.actionItems.forEach((x) => {
          allTasks.push(`• **"${m.title}"** — ${x.task} (Owner: **${x.assignee}**, Due: ${x.dueDate})`);
        });
      }
    });
    if (allTasks.length > 0) {
      return `Here are the action items assigned across your workspace:\n\n${allTasks.join('\n')}`;
    }
  }

  // Helpful general chatbot fallback response when no meeting match is found
  return `I reviewed your ${userMeetings.length} workspace recording(s), but found no direct references to "${query}".\n\nIf you have a general question about coding, architecture, design, or project planning, feel free to ask! You can also search specific meetings or upload new recordings.`;
}
