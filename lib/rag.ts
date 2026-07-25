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
      // Term matching
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
/**
 * Builds the content-type-specific block of the chat system prompt, so the
 * AI Copilot has the right grounding regardless of whether it's chatting
 * about a meeting, a lecture, a coding session, or a podcast.
 */
function buildTypeSpecificContext(meeting: Meeting): string {
  const a = meeting.analysis;
  if (!a) return '';

  switch (a.contentType) {
    case 'lecture':
      return [
        a.notes?.length ? `Study Notes: ${a.notes.join('; ')}` : '',
        a.flashcards?.length ? `Flashcard Topics: ${a.flashcards.map(f => f.question).join('; ')}` : '',
      ].filter(Boolean).join('\n');

    case 'coding':
      return [
        a.codeGuide ? `Code Guide: ${a.codeGuide}` : '',
        a.apis?.length ? `APIs Discussed: ${a.apis.map(x => `${x.name} (${x.description})`).join('; ')}` : '',
        a.libraries?.length ? `Libraries Discussed: ${a.libraries.map(x => `${x.name} (${x.purpose})`).join('; ')}` : '',
        a.commands?.length ? `Commands Referenced: ${a.commands.map(x => x.command).join('; ')}` : '',
      ].filter(Boolean).join('\n');

    case 'podcast':
      return [
        a.keyInsights?.length ? `Key Insights: ${a.keyInsights.join('; ')}` : '',
        a.timeline?.length ? `Timeline: ${a.timeline.map(t => `[${t.timestamp}] ${t.topic}`).join('; ')}` : '',
        a.resources?.length ? `Resources Mentioned: ${a.resources.map(r => r.name).join('; ')}` : '',
      ].filter(Boolean).join('\n');

    case 'general':
      return a.keyDiscussionPoints?.length ? `Key Points: ${a.keyDiscussionPoints.join('; ')}` : '';

    case 'meeting':
    default:
      return [
        `Decisions: ${a.decisions?.length ? a.decisions.map(d => `${d.decision} (by ${d.decider})`).join('; ') : 'N/A'}`,
        `Action Items: ${a.actionItems?.length ? a.actionItems.map(x => `${x.task} (Assignee: ${x.assignee}, Due: ${x.dueDate})`).join('; ') : 'N/A'}`,
      ].join('\n');
  }
}

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

  const systemPrompt = `You are the AI Copilot for the recording "${meeting.title}".
Your job is to answer user questions grounded EXCLUSIVELY in the transcript context provided below.

CRITICAL INSTRUCTIONS:
1. Base your answer strictly on the context.
2. ALWAYS include timestamp citations in your response when referencing statements or topics (e.g. "Speaker 1 mentioned... Source: [00:03:12]").
3. Synthesize clear, intelligent, professional answers in complete sentences.
4. If a question cannot be answered from the transcript, state: "I cannot find specific discussion details about this in the recording."

Content Context:
Summary: ${meeting.analysis?.summary || 'N/A'}
${buildTypeSpecificContext(meeting)}

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
        model: 'llama3.1-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 800,
      });
      const responseText = completion.choices[0].message.content || '';
      if (responseText.trim() !== '') return responseText;
    } catch (err: any) {
      if (!err.message?.includes('404')) {
        console.warn('[RAG Engine] Llama API notice:', err.message);
      }
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

  // 3. Fallback Fully Dynamic Grounded RAG Generator
  return fallbackGroundedRAG(query, meeting, index, retrievedChunks);
}

// ---------------------------------------------------------------------------
// FULLY DYNAMIC GROUNDED RAG GENERATOR (ZERO HARDCODED NAMES OR QUESTIONS)
// ---------------------------------------------------------------------------
function fallbackGroundedRAG(
  query: string, 
  meeting: Meeting, 
  index: ContextualMeetingIndex, 
  retrievedChunks: SemanticChunk[]
): string {
  const queryTokens = tokenize(query);
  const allChunks = index.chunks;

  // 1. If query matches speaker count / who spoke
  const isSpeakerQuery = queryTokens.some(t => ['speaker', 'speakers', 'who', 'participant', 'participants', 'people', 'person'].includes(t));
  if (isSpeakerQuery && index.speakers.length > 0) {
    const speakerList = index.speakers.map(s => {
      const firstLine = allChunks.find(c => c.speaker === s);
      return firstLine ? `• **${s}** — First active at [${firstLine.timestamp}]: "${firstLine.text}"` : `• **${s}**`;
    }).join('\n');

    return `Based on the recording context, there are **${index.speakers.length} active speaker(s)** identified in "${meeting.title}":\n\n${speakerList}`;
  }

  // 2. Dynamic Semantic Retrieval from Transcribed Chunks
  const targetChunks = retrievedChunks.length > 0 ? retrievedChunks : allChunks.slice(0, 5);

  if (targetChunks.length > 0) {
    const structuredAnswers = targetChunks.map(c => 
      `• **${c.speaker}** [${c.timestamp}]: "${c.text}"`
    ).join('\n\n');

    const summaryOverview = meeting.analysis?.summary ? `**Session Summary Context:**\n${meeting.analysis.summary}\n\n` : '';

    return `Based on the transcript context for "${meeting.title}", here are the relevant details:\n\n${summaryOverview}**Relevant Dialogue Statements:**\n\n${structuredAnswers}`;
  }

  return `I analyzed the transcript for "${meeting.title}". Here is the executive overview:\n\n${meeting.analysis?.summary || 'No summary available.'}`;
}
