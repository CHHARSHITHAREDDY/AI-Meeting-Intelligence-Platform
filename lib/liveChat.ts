import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { LiveMeetingRecord } from './liveMeetingStore';

/**
 * Answers a user's question grounded strictly in the live meeting's processed
 * transcript + extracted insights (decisions/action items/risks). Mirrors the
 * fallback chain used by the recorded-meeting chat route: Llama -> Anthropic
 * -> local keyword/heuristic answer, so it degrades gracefully with no API keys.
 */
export async function answerLiveMeetingQuestion(meeting: LiveMeetingRecord, question: string): Promise<string> {
  const transcript = meeting.transcriptText?.trim() || '';
  const { insights } = meeting;

  if (!transcript) {
    return "There's no transcript captured yet for this meeting — start speaking or play the audio source and I'll be able to answer questions based on what's said.";
  }

  const contextBlock = `Meeting Title: ${meeting.title}
Status: ${meeting.status}
Live Summary: ${insights.summary}

Decisions so far:
${insights.decisions.map((d) => `- ${d.title} (${d.timestamp || 'time unknown'}, confidence ${d.confidence ?? '—'}%)`).join('\n') || '- None yet'}

Action Items so far:
${insights.actionItems.map((a) => `- ${a.title} [Owner: ${a.assignee || 'Unassigned'}${a.dueDate ? `, Deadline: ${a.dueDate}` : ''}${a.priority ? `, Priority: ${a.priority}` : ''}]`).join('\n') || '- None yet'}

Risks so far:
${insights.risks.map((r) => `- ${r.title} [Severity: ${r.severity || 'unknown'}]`).join('\n') || '- None yet'}

Full Transcript:
"""
${transcript}
"""`;

  const systemPrompt = `You are the AI assistant embedded in a live meeting intelligence tool. Answer the user's question using ONLY the meeting context and transcript provided below. Be concise and specific. If the transcript doesn't contain the answer, say so plainly instead of guessing.

${contextBlock}`;

  const llamaApiKey = process.env.LLAMA_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
    try {
      const client = new OpenAI({ apiKey: llamaApiKey, baseURL: 'https://api.llama-api.com' });
      const completion = await client.chat.completions.create({
        model: 'llama3.1-70b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 700,
      });
      const reply = completion.choices[0]?.message?.content;
      if (reply) return reply;
    } catch (err: any) {
      console.error('[Live Chat] Llama API failed:', err.message);
    }
  }

  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      });
      const reply = response.content[0].type === 'text' ? response.content[0].text : '';
      if (reply) return reply;
    } catch (err: any) {
      console.error('[Live Chat] Anthropic fallback failed:', err.message);
    }
  }

  return heuristicAnswer(meeting, question);
}

function heuristicAnswer(meeting: LiveMeetingRecord, question: string): string {
  const q = question.toLowerCase();
  const { insights } = meeting;

  if (q.includes('summar')) {
    return insights.summary || 'No summary available yet.';
  }
  if (q.includes('decision')) {
    return insights.decisions.length
      ? `Decisions made so far:\n${insights.decisions.map((d) => `• ${d.title} (${d.timestamp || ''})`).join('\n')}`
      : 'No decisions have been detected yet.';
  }
  if (q.includes('task') || q.includes('action') || q.includes('pending') || q.includes('todo')) {
    return insights.actionItems.length
      ? `Action items:\n${insights.actionItems.map((a) => `• ${a.title} — Owner: ${a.assignee || 'Unassigned'}${a.dueDate ? `, Deadline: ${a.dueDate}` : ''}`).join('\n')}`
      : 'No action items have been detected yet.';
  }
  if (q.includes('risk') || q.includes('blocker') || q.includes('block')) {
    return insights.risks.length
      ? `Risks flagged:\n${insights.risks.map((r) => `• ${r.title} (Severity: ${r.severity || 'unknown'})`).join('\n')}`
      : 'No risks have been flagged yet.';
  }
  if (q.includes('own') || q.includes('who')) {
    const match = insights.actionItems.find((a) => q.includes((a.title || '').toLowerCase().split(' ')[0]));
    if (match) return `${match.assignee || 'Unassigned'} owns "${match.title}".`;
  }

  // Generic keyword search over the transcript, similar to the recorded-meeting chat fallback.
  const stopWords = new Set(['what', 'when', 'where', 'who', 'how', 'why', 'that', 'this', 'there', 'their', 'them', 'with', 'from', 'about', 'some', 'they', 'have', 'your', 'does', 'tell', 'meeting', 'happened', 'last', 'minutes']);
  const keywords = q.replace(/[?.,!:-]/g, '').split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length > 0) {
    const lines = meeting.transcriptEntries.map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`);
    const scored = lines
      .map((line) => {
        const lower = line.toLowerCase();
        const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
        return { line, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length > 0) {
      return `Based on the transcript, here's what's most relevant:\n\n${scored.map((s) => `• ${s.line}`).join('\n')}`;
    }
  }

  return "I couldn't find anything specific about that in the transcript so far. Try asking for a summary, decisions, action items, or risks.";
}
