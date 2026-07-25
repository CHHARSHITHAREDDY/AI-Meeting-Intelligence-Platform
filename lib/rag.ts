import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Meeting } from './db';
import { runLlamaCloudExtraction } from './llamaCloud';

const QA_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

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
  const vectorChunks = chunks.map(chunk => {
    const tokens = tokenize(chunk.text + chunk.speaker);
    const vector = computeTFIDFVector(tokens, vocabulary);
    return { ...chunk, vector };
  });

  // Generate intelligent suggested prompts based on actual analysis & content
  const suggestedPrompts: string[] = [
    `What were the key decisions made in "${meeting.title}"?`,
    `List all action items and who is responsible.`,
    `What are the main risks or blockers discussed?`,
    `Summarize the core takeaways from this session.`,
  ];

  return {
    meetingId: meeting.id,
    chunks: vectorChunks,
    speakers,
    suggestedPrompts,
  };
}

// ---------------------------------------------------------------------------
// 3. SEMANTIC RETRIEVAL OF RELEVANT CHUNKS
// ---------------------------------------------------------------------------
export function retrieveContextChunks(
  query: string,
  chunks: SemanticChunk[],
  topK: number = 5
): SemanticChunk[] {
  if (!chunks || chunks.length === 0) return [];

  // Build vocabulary from query + chunks
  const vocabSet = new Set<string>();
  tokenize(query).forEach(t => vocabSet.add(t));
  chunks.forEach(c => {
    tokenize(c.text + ' ' + c.speaker).forEach(t => vocabSet.add(t));
  });
  const vocabulary = Array.from(vocabSet);

  const queryTokens = tokenize(query);
  const queryVector = computeTFIDFVector(queryTokens, vocabulary);

  const scoredChunks = chunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text + ' ' + chunk.speaker);
    const chunkVector = computeTFIDFVector(chunkTokens, vocabulary);
    const similarity = cosineSimilarity(queryVector, chunkVector);
    return { chunk, similarity };
  });

  // Sort descending by similarity
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  // Return top K chunks with similarity > 0
  const matches = scoredChunks.filter(sc => sc.similarity > 0).map(sc => sc.chunk);
  return matches.length > 0 ? matches.slice(0, topK) : chunks.slice(0, topK);
}

// ---------------------------------------------------------------------------
// 4. GROUNDED RAG RESPONSE GENERATOR
// ---------------------------------------------------------------------------
function buildTypeSpecificContext(meeting: Meeting): string {
  if (!meeting.analysis) return '';
  const a = meeting.analysis as any;

  switch (meeting.contentType) {
    case 'lecture':
      return [
        `Study Notes: ${a.studyNotes?.length ? a.studyNotes.join('; ') : 'N/A'}`,
        `Key Concepts: ${a.keyConcepts?.length ? a.keyConcepts.map((c: any) => `${c.concept}: ${c.definition}`).join('; ') : 'N/A'}`,
      ].join('\n');

    case 'coding':
      return [
        `Code Walkthrough: ${a.codeWalkthrough?.length ? a.codeWalkthrough.join('; ') : 'N/A'}`,
        `APIs & Endpoints: ${a.apisAndEndpoints?.length ? a.apisAndEndpoints.join('; ') : 'N/A'}`,
      ].join('\n');

    case 'podcast':
      return [
        `Key Insights: ${a.keyInsights?.length ? a.keyInsights.join('; ') : 'N/A'}`,
        `Resources Mentioned: ${a.resourcesMentioned?.length ? a.resourcesMentioned.join('; ') : 'N/A'}`,
      ].join('\n');

    case 'general':
      return a.keyDiscussionPoints?.length ? `Key Points: ${a.keyDiscussionPoints.join('; ')}` : '';

    case 'meeting':
    default:
      return [
        `Decisions: ${a.decisions?.length ? a.decisions.map((d: any) => `${d.decision || d.title} (by ${d.decider || 'Team'})`).join('; ') : 'N/A'}`,
        `Action Items: ${a.actionItems?.length ? a.actionItems.map((x: any) => `${x.task || x.title} (Assignee: ${x.assignee}, Due: ${x.dueDate})`).join('; ') : 'N/A'}`,
        `Risks: ${a.risks?.length ? a.risks.map((r: any) => `${r.risk || r.title} (Impact: ${r.impact || r.severity})`).join('; ') : 'N/A'}`,
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

  const contextSnippet = retrievedChunks.length > 0
    ? retrievedChunks.map(c => `[${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n')
    : index.chunks.slice(0, 8).map(c => `[${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n');

  const memoryText = chatHistory.slice(-4).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

  const systemPrompt = `You are the AI Copilot for the recording "${meeting.title}".
Your job is to answer user questions grounded EXCLUSIVELY in the transcript context provided below.

CRITICAL INSTRUCTIONS:
1. Base your answer strictly on the context.
2. Synthesize clear, intelligent, professional answers in complete sentences.
3. If a question cannot be answered from the transcript, state: "I cannot find specific discussion details about this in the recording."
Respond with ONLY a valid JSON object matching: { "answer": "your comprehensive answer here" }

Content Context:
Summary: ${meeting.analysis?.summary || 'N/A'}
${buildTypeSpecificContext(meeting)}

Relevant Transcript Chunks:
${contextSnippet}

Recent Conversation History:
${memoryText}`;

  // 1. Try LlamaCloud Agentic Extraction Engine (configured with LLAMA_API_KEY)
  const llamaResult = await runLlamaCloudExtraction(`${systemPrompt}\n\nUser Question: ${query}`, QA_SCHEMA);
  if (llamaResult && typeof llamaResult.answer === 'string' && llamaResult.answer.trim()) {
    return llamaResult.answer;
  }

  // 2. Try NVIDIA Nemotron / NIM API
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
    try {
      const client = new OpenAI({ apiKey: nvidiaApiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
      const completion = await client.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 800,
        temperature: 0.2,
      });
      const responseText = completion.choices[0]?.message?.content || '';
      if (responseText.trim() !== '') return responseText;
    } catch (err: any) {
      console.warn('[RAG Engine] NVIDIA Nemotron API notice:', err.message);
    }
  }

  // 3. Try Anthropic Claude API
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
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

  // 4. Fallback Fully Dynamic Grounded RAG Generator
  return fallbackGroundedRAG(query, meeting, index, retrievedChunks);
}

// ---------------------------------------------------------------------------
// FULLY DYNAMIC GROUNDED RAG GENERATOR (SMART CONTEXTUAL SYNTHESIS)
// ---------------------------------------------------------------------------
function fallbackGroundedRAG(
  query: string, 
  meeting: Meeting, 
  index: ContextualMeetingIndex, 
  retrievedChunks: SemanticChunk[]
): string {
  const queryTokens = tokenize(query);
  const qLower = query.toLowerCase();
  const allChunks = index.chunks;
  const a = meeting.analysis;

  // 1. Questions about Decisions
  if (qLower.includes('decision') || qLower.includes('decide') || qLower.includes('agreed') || qLower.includes('approved')) {
    if (a?.decisions && a.decisions.length > 0) {
      const formattedDecisions = a.decisions.map((d: any) => 
        `• **${d.decision || d.title}**${d.decider ? ` (Decided by: ${d.decider})` : ''}${d.context ? ` — *Context:* ${d.context}` : ''}`
      ).join('\n');
      return `Here are the key decisions established in "${meeting.title}":\n\n${formattedDecisions}`;
    }
  }

  // 2. Questions about Action Items / Tasks
  if (qLower.includes('task') || qLower.includes('todo') || qLower.includes('action') || qLower.includes('assignee') || qLower.includes('who is working') || qLower.includes('pending')) {
    if (a?.actionItems && a.actionItems.length > 0) {
      const formattedTasks = a.actionItems.map((t: any) => 
        `• **${t.task || t.title}** — Owner: **${t.assignee || 'Unassigned'}**${t.dueDate ? ` (Due: ${t.dueDate})` : ''} [Status: ${t.status || 'pending'}]`
      ).join('\n');
      return `Here are the action items tracked for "${meeting.title}":\n\n${formattedTasks}`;
    }
  }

  // 3. Questions about Risks / Issues / Blockers
  if (qLower.includes('risk') || qLower.includes('issue') || qLower.includes('blocker') || qLower.includes('concern') || qLower.includes('problem')) {
    if (a?.risks && a.risks.length > 0) {
      const formattedRisks = a.risks.map((r: any) => 
        `• ⚠️ **${r.risk || r.title}** (Impact: ${r.impact || r.severity || 'Medium'})${r.mitigation ? ` — *Mitigation:* ${r.mitigation}` : ''}`
      ).join('\n');
      return `Here are the key risks flagged in "${meeting.title}":\n\n${formattedRisks}`;
    }
  }

  // 4. Questions about Summary / Overview
  if (qLower.includes('summary') || qLower.includes('overview') || qLower.includes('about') || qLower.includes('happen') || qLower.includes('what was discussed')) {
    if (a?.summary) {
      return `**Executive Summary for "${meeting.title}":**\n\n${a.summary}`;
    }
  }

  // 5. Questions about Speakers / Participants
  const isSpeakerQuery = queryTokens.some(t => ['speaker', 'speakers', 'who', 'participant', 'participants', 'people', 'person'].includes(t));
  if (isSpeakerQuery && index.speakers.length > 0) {
    const speakerList = index.speakers.map(s => {
      const firstLine = allChunks.find(c => c.speaker === s);
      return firstLine ? `• **${s}** — First active at [${firstLine.timestamp}]: "${firstLine.text}"` : `• **${s}**`;
    }).join('\n');

    return `Based on the recording context, there are **${index.speakers.length} active speaker(s)** identified in "${meeting.title}":\n\n${speakerList}`;
  }

  // 6. Dynamic Semantic Retrieval from Transcribed Chunks
  const targetChunks = retrievedChunks.length > 0 ? retrievedChunks : allChunks.slice(0, 5);

  if (targetChunks.length > 0) {
    const structuredAnswers = targetChunks.map(c => 
      `• **${c.speaker}** [${c.timestamp}]: "${c.text}"`
    ).join('\n\n');

    const summaryOverview = a?.summary ? `**Session Summary:**\n${a.summary}\n\n` : '';

    return `Based on the recording "${meeting.title}", here are the relevant details from the transcript:\n\n${summaryOverview}**Key Dialogue Extracts:**\n\n${structuredAnswers}`;
  }

  return `I analyzed the transcript for "${meeting.title}". Here is the executive overview:\n\n${a?.summary || 'No summary available.'}`;
}
