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
    const { message } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const transcript = meeting.transcript || 'No transcript available for this meeting.';
    
    // Prepare LLM prompt
    const systemPrompt = `You are a helpful AI assistant for the meeting intelligence platform.
You are answering user questions about the following meeting transcript.
Meeting Title: ${meeting.title}
Meeting Date: ${meeting.date}

Transcript:
"""
${transcript}
"""

Base your answer strictly on the transcript provided above. If the transcript does not contain the answer, say "I cannot find this information in the transcript." concisely.`;

    const llamaApiKey = process.env.LLAMA_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    let reply = '';

    // 1. Try Llama API first
    if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
      try {
        console.log('[Chat Route] Querying Llama API...');
        const client = new OpenAI({
          apiKey: llamaApiKey,
          baseURL: 'https://api.llama-api.com',
        });
        const chatCompletion = await client.chat.completions.create({
          model: 'llama3.1-70b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 800,
        });
        reply = chatCompletion.choices[0].message.content || '';
      } catch (err: any) {
        console.error('[Chat Route] Llama API error:', err.message);
      }
    }

    // 2. Fallback to Anthropic if Llama API failed
    if (!reply && anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
      try {
        console.log('[Chat Route] Falling back to Anthropic (Claude)...');
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        });
        reply = response.content[0].type === 'text' ? response.content[0].text : '';
      } catch (err: any) {
        console.error('[Chat Route] Anthropic fallback failed:', err.message);
      }
    }

    // 3. Heuristic / Local fallback if no keys are present or all failed
    if (!reply) {
      console.log('[Chat Route] No API keys available or all failed. Using offline mockup answer.');
      const q = message.toLowerCase();
      
      if (q.includes('decision') || q.includes('decide')) {
        const decs = meeting.analysis?.decisions.map(d => `• ${d.decision} (by ${d.decider})`).join('\n') || 'No decisions found.';
        reply = `Based on the transcript, here are the decisions:\n${decs}`;
      } else if (q.includes('task') || q.includes('action') || q.includes('todo')) {
        const acts = meeting.analysis?.actionItems.map(a => `• ${a.task} [Assignee: ${a.assignee}, Due: ${a.dueDate}]`).join('\n') || 'No action items found.';
        reply = `The action items assigned are:\n${acts}`;
      } else if (q.includes('risk') || q.includes('worry') || q.includes('issue')) {
        const risks = meeting.analysis?.risks.map(r => `• ${r.risk} [Impact: ${r.impact}]`).join('\n') || 'No risks found.';
        reply = `The identified risks in the meeting are:\n${risks}`;
      } else if (q.includes('summary')) {
        reply = meeting.analysis?.summary || 'No summary available.';
      } else {
        // Extract key terms from the query, filtering common words
        const stopWords = new Set(['what', 'when', 'where', 'who', 'how', 'why', 'that', 'this', 'there', 'their', 'them', 'with', 'from', 'about', 'some', 'they', 'have', 'your', 'from', 'does', 'tell', 'from', 'video', 'transcript', 'meeting', 'show']);
        const keywords = q
          .replace(/[?.,!:-]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 2 && !stopWords.has(w));

        if (keywords.length > 0) {
          // Rank lines based on keyword overlap
          const transcriptLines = transcript.split('\n');
          const matches = transcriptLines
            .map((line: string) => {
              let score = 0;
              const lowerLine = line.toLowerCase();
              keywords.forEach((kw: string) => {
                if (lowerLine.includes(kw)) {
                  score += 1;
                }
              });
              return { line, score };
            })
            .filter((item: { line: string; score: number }) => item.score > 0)
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
            .slice(0, 4);

          if (matches.length > 0) {
            reply = `Based on the meeting transcript context, here are the most relevant discussion snippets found:\n\n${matches.map((m: { line: string; score: number }) => `• ${m.line}`).join('\n')}`;
          } else {
            reply = `I couldn't find specific discussion details about those terms in the transcript. However, here is the summary of this session:\n\n${meeting.analysis?.summary || 'No summary available.'}`;
          }
        } else {
          reply = `I am running in offline mode. Please ask a specific question about the meeting context, such as decisions, action items, or key topics discussed.`;
        }
      }
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('[Chat Route] General error:', error);
    return NextResponse.json({ error: 'Failed to process chat: ' + error.message }, { status: 500 });
  }
}
