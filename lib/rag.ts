import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Meeting } from './db';

export interface SemanticChunk {
  id: string;
  meetingId: string;
  speaker: string;
  timestamp: string;
  text: string;
  vector?: number[];
}

export interface ContextualMeetingIndex {
  meetingId: string;
  chunks: SemanticChunk[];
  speakers: string[];
  suggestedPrompts: string[];
}

// ---------------------------------------------------------------------------
// 1. SEMANTIC CHUNKING OF TRANSCRIPT
// ---------------------------------------------------------------------------
export function chunkTranscript(transcript: string, meetingId: string): SemanticChunk[] {
  if (!transcript || transcript.trim() === '') return [];

  const lines = transcript.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const chunks: SemanticChunk[] = [];

  lines.forEach((line, idx) => {
    const match = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/i);
    if (match) {
      chunks.push({
        id: `chk-${meetingId}-${idx + 1}`,
        meetingId,
        timestamp: match[1],
        speaker: match[2].trim(),
        text: match[3].trim(),
      });
    } else {
      chunks.push({
        id: `chk-${meetingId}-${idx + 1}`,
        meetingId,
        timestamp: '00:00',
        speaker: 'Participant',
        text: line,
      });
    }
  });

  return chunks;
}

// ---------------------------------------------------------------------------
// 2. VECTOR EMBEDDING & TF-IDF COSINE SIMILARITY ENGINE
// ---------------------------------------------------------------------------
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function computeTFIDFVector(tokens: string[], vocabulary: string[]): number[] {
  const termCounts: { [key: string]: number } = {};
  tokens.forEach(t => {
    termCounts[t] = (termCounts[t] || 0) + 1;
  });

  return vocabulary.map(term => {
    const tf = (termCounts[term] || 0) / (tokens.length || 1);
    return tf;
  });
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function indexMeetingContext(meeting: Meeting): ContextualMeetingIndex {
  const chunks = chunkTranscript(meeting.transcript, meeting.id);
  const speakers = Array.from(new Set(chunks.map(c => c.speaker)));

  // Build vocabulary across all chunks
  const vocabSet = new Set<string>();
  chunks.forEach(c => {
    tokenize(c.text + ' ' + c.speaker).forEach(t => vocabSet.add(t));
  });
  const vocabulary = Array.from(vocabSet);

  // Compute vector for each chunk
  chunks.forEach(c => {
    const tokens = tokenize(c.text + ' ' + c.speaker);
    c.vector = computeTFIDFVector(tokens, vocabulary);
  });

  // Auto-generate suggested prompts dynamically from speakers & meeting analysis
  const suggestedPrompts: string[] = [
    "What were the key decisions made?",
    "What risks were identified?",
    "What action items were assigned?",
    "Generate Executive MOM",
  ];

  if (speakers.length > 0) {
    suggestedPrompts.push(`What did ${speakers[0]} discuss?`);
    if (speakers[1]) {
      suggestedPrompts.push(`Summarize ${speakers[1]}'s points.`);
    }
  }

  return {
    meetingId: meeting.id,
    chunks,
    speakers,
    suggestedPrompts,
  };
}

// ---------------------------------------------------------------------------
// 3. VECTOR SEMANTIC SEARCH RETRIEVAL
// ---------------------------------------------------------------------------
export function retrieveContextChunks(query: string, chunks: SemanticChunk[], topK = 5): SemanticChunk[] {
  if (!chunks || chunks.length === 0) return [];

  // Build vocabulary from chunks
  const vocabSet = new Set<string>();
  chunks.forEach(c => {
    tokenize(c.text + ' ' + c.speaker).forEach(t => vocabSet.add(t));
  });
  const vocabulary = Array.from(vocabSet);

  const queryTokens = tokenize(query);
  const queryVector = computeTFIDFVector(queryTokens, vocabulary);

  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    if (chunk.vector && chunk.vector.length === queryVector.length) {
      score = cosineSimilarity(queryVector, chunk.vector);
    } else {
      // Fallback term matching
      const chunkTokens = tokenize(chunk.text + ' ' + chunk.speaker);
      const overlap = queryTokens.filter(t => chunkTokens.includes(t)).length;
      score = overlap / (queryTokens.length || 1);
    }
    return { chunk, score };
  });

  return scoredChunks
    .filter(sc => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(sc => sc.chunk);
}

// ---------------------------------------------------------------------------
// 4. GROUNDED RAG GENERATOR WITH CHAT MEMORY & TIMESTAMP CITATIONS
// ---------------------------------------------------------------------------
export async function generateGroundedRAGAnswer(
  query: string,
  meeting: Meeting,
  chatHistory: { sender: 'user' | 'assistant'; text: string }[] = []
): Promise<string> {
  const index = indexMeetingContext(meeting);
  const retrievedChunks = retrieveContextChunks(query, index.chunks, 5);

  // Format retrieved chunks with timestamps & speakers
  const contextSnippet = retrievedChunks.length > 0
    ? retrievedChunks.map(c => `[${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n')
    : index.chunks.slice(0, 8).map(c => `[${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n');

  // Format conversation memory
  const memoryText = chatHistory.slice(-4).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

  const systemPrompt = `You are the AI Meeting Copilot for the meeting "${meeting.title}".
Your job is to answer user questions grounded EXCLUSIVELY in the meeting transcript context provided below.

CRITICAL INSTRUCTIONS:
1. Base your answer strictly on the meeting context.
2. ALWAYS include timestamp citations in your response when referencing statements or topics (e.g. "Speaker 1 mentioned... Source: [00:03:12]").
3. If the user asks for a summary, MOM, decisions, or action items, format them cleanly using Markdown bullet points.
4. If a question cannot be answered from the meeting transcript, politely state: "I cannot find specific discussion details about this in the meeting recording."

Meeting Context:
Summary: ${meeting.analysis?.summary || 'N/A'}
Decisions: ${meeting.analysis?.decisions.map(d => `${d.decision} (by ${d.decider})`).join('; ') || 'N/A'}
Action Items: ${meeting.analysis?.actionItems.map(a => `${a.task} (Assignee: ${a.assignee}, Due: ${a.dueDate})`).join('; ') || 'N/A'}

Relevant Transcript Chunks:
${contextSnippet}

Recent Conversation History:
${memoryText}`;

  const llamaApiKey = process.env.LLAMA_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  // 1. Try Llama API
  if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
    try {
      const client = new OpenAI({ apiKey: llamaApiKey, baseURL: 'https://api.llama-api.com' });
      const completion = await client.chat.completions.create({
        model: 'llama3.1-70b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 800,
      });
      const responseText = completion.choices[0].message.content || '';
      if (responseText.trim() !== '') return responseText;
    } catch (err: any) {
      console.warn('[RAG Engine] Llama API error:', err.message);
    }
  }

  // 2. Try Anthropic Claude API
  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const res = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      });
      const responseText = res.content[0].type === 'text' ? res.content[0].text : '';
      if (responseText.trim() !== '') return responseText;
    } catch (err: any) {
      console.warn('[RAG Engine] Anthropic API error:', err.message);
    }
  }

  // 3. Fallback Grounded Engine with Citations
  return fallbackGroundedRAG(query, meeting, retrievedChunks);
}

function fallbackGroundedRAG(query: string, meeting: Meeting, retrievedChunks: SemanticChunk[]): string {
  const q = query.toLowerCase();

  if (q.includes('mom') || q.includes('minutes of meeting')) {
    const decs = meeting.analysis?.decisions.map(d => `• **${d.decision}** (Decider: ${d.decider})`).join('\n') || '• None.';
    const acts = meeting.analysis?.actionItems.map(a => `• **${a.task}** [Assignee: ${a.assignee}, Due: ${a.dueDate}]`).join('\n') || '• None.';
    return `📋 **MINUTES OF MEETING (MOM)**\n\n**Meeting:** ${meeting.title}\n**Date:** ${new Date(meeting.date).toLocaleDateString()}\n\n**Executive Summary:**\n${meeting.analysis?.summary || ''}\n\n**Key Decisions:**\n${decs}\n\n**Action Items:**\n${acts}`;
  }

  if (q.includes('decision') || q.includes('decide')) {
    const decs = meeting.analysis?.decisions.map(d => `• **${d.decision}** (Decider: ${d.decider})\n  *Context:* ${d.context}`).join('\n\n') || 'No formal decisions recorded.';
    return `Based on the meeting transcript, here are the decisions:\n\n${decs}`;
  }

  if (q.includes('task') || q.includes('action') || q.includes('todo')) {
    const acts = meeting.analysis?.actionItems.map(a => `• **${a.task}**\n  *Assignee:* ${a.assignee} | *Due:* ${a.dueDate}`).join('\n\n') || 'No action items assigned.';
    return `The action items identified from the meeting are:\n\n${acts}`;
  }

  if (q.includes('risk') || q.includes('worry') || q.includes('issue')) {
    const risks = meeting.analysis?.risks.map(r => `• **[${r.impact.toUpperCase()} IMPACT]** ${r.risk}\n  *Mitigation:* ${r.mitigation}`).join('\n\n') || 'No major risks identified.';
    return `The risks identified in this meeting are:\n\n${risks}`;
  }

  if (retrievedChunks.length > 0) {
    const citations = retrievedChunks.map(c => `• ${c.speaker}: "${c.text}"\n  *Source:* [${c.timestamp}]`).join('\n\n');
    return `Based on the meeting transcript context, here are the relevant discussion details:\n\n${citations}`;
  }

  return `I analyzed the meeting recording. Here is the summary of this session:\n\n${meeting.analysis?.summary || 'No summary available.'}`;
}
