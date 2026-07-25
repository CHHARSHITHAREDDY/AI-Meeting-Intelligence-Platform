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

export interface ActionItemTraceMatch {
  index: number;
  timestamp: string;
  speaker: string;
  sentence: string;
}

export function matchActionItemToChunk(actionItemText: string, chunks: SemanticChunk[]): ActionItemTraceMatch | null {
  if (!actionItemText || chunks.length === 0) return null;

  const itemTokens = new Set(tokenize(actionItemText));
  if (itemTokens.size === 0) return null;

  let bestIndex = -1;
  let bestScore = 0;

  chunks.forEach((chunk, idx) => {
    const chunkTokens = tokenize(chunk.text);
    if (chunkTokens.length === 0) return;
    const overlap = chunkTokens.filter(t => itemTokens.has(t)).length;
    const score = overlap / Math.sqrt(chunkTokens.length);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  });

  if (bestIndex === -1 || bestScore === 0) return null;
  const match = chunks[bestIndex];
  return { index: bestIndex, timestamp: match.timestamp, speaker: match.speaker, sentence: match.text };
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

  const vocabSet = new Set<string>();
  chunks.forEach(c => {
    tokenize(c.text + ' ' + c.speaker).forEach(t => vocabSet.add(t));
  });
  const vocabulary = Array.from(vocabSet);

  chunks.forEach(c => {
    const tokens = tokenize(c.text + ' ' + c.speaker);
    c.vector = computeTFIDFVector(tokens, vocabulary);
  });

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
// 3. HYBRID SEMANTIC SEARCH & CONCEPT ENHANCED RETRIEVAL
// ---------------------------------------------------------------------------
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  decision: ['decision', 'decisions', 'agreed', 'decided', 'conclusion', 'resolved', 'approve'],
  action: ['action', 'task', 'assigned', 'assignee', 'todo', 'work', 'due', 'owner', 'pending'],
  risk: ['risk', 'risks', 'blocker', 'issue', 'concern', 'problem', 'mitigation', 'challenge'],
  deadline: ['deadline', 'schedule', 'date', 'timeline', 'due', 'by'],
};

export function retrieveContextChunks(query: string, chunks: SemanticChunk[], topK = 6): SemanticChunk[] {
  if (!chunks || chunks.length === 0) return [];

  const vocabSet = new Set<string>();
  chunks.forEach(c => {
    tokenize(c.text + ' ' + c.speaker).forEach(t => vocabSet.add(t));
  });
  const vocabulary = Array.from(vocabSet);

  const rawQueryTokens = tokenize(query);
  if (rawQueryTokens.length === 0) return chunks.slice(0, topK);

  // Expand query with synonyms & concept terms
  const expandedQueryTokens = new Set<string>(rawQueryTokens);
  rawQueryTokens.forEach(t => {
    Object.entries(CONCEPT_SYNONYMS).forEach(([concept, syns]) => {
      if (syns.includes(t) || t.includes(concept)) {
        syns.forEach(s => expandedQueryTokens.add(s));
      }
    });
  });

  const queryTokenList = Array.from(expandedQueryTokens);
  const queryVector = computeTFIDFVector(queryTokenList, vocabulary);

  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    const chunkTextLower = (chunk.text + ' ' + chunk.speaker).toLowerCase();
    const chunkTokens = tokenize(chunkTextLower);

    // 1. Vector Cosine Similarity
    if (chunk.vector && chunk.vector.length === queryVector.length) {
      score += cosineSimilarity(queryVector, chunk.vector) * 0.6;
    }

    // 2. Token Overlap Score
    const overlap = queryTokenList.filter(t => chunkTokens.includes(t)).length;
    if (queryTokenList.length > 0) {
      score += (overlap / queryTokenList.length) * 0.4;
    }

    // 3. Entity & Speaker Boost
    rawQueryTokens.forEach(qt => {
      if (chunk.speaker.toLowerCase().includes(qt)) {
        score += 0.5;
      }
      if (chunkTextLower.includes(qt)) {
        score += 0.2;
      }
    });

    return { chunk, score };
  });

  const filtered = scoredChunks
    .filter(sc => sc.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(sc => sc.chunk);

  if (filtered.length > 0) return filtered;

  // Fallback: substring keyword match
  const keywordMatches = chunks.filter(c => 
    rawQueryTokens.some(qt => (c.text + ' ' + c.speaker).toLowerCase().includes(qt))
  );

  return keywordMatches.slice(0, topK);
}

// ---------------------------------------------------------------------------
// 4. GROUNDED RAG GENERATOR WITH FULL TRACEABILITY LOGGING
// ---------------------------------------------------------------------------
function buildStructuredContextBlock(meeting: Meeting): string {
  const a = meeting.analysis;
  if (!a) return '';

  const blocks: string[] = [];

  if (a.decisions && a.decisions.length > 0) {
    blocks.push(`Decisions Made:\n` + a.decisions.map(d => `- [${d.id}] ${d.decision} (Decided by: ${d.decider}, Context: ${d.context})`).join('\n'));
  }

  if (a.actionItems && a.actionItems.length > 0) {
    blocks.push(`Action Items & Assignments:\n` + a.actionItems.map(x => `- [${x.id}] ${x.task} (Assignee: ${x.assignee}, Due: ${x.dueDate}, Status: ${x.status})`).join('\n'));
  }

  if (a.risks && a.risks.length > 0) {
    blocks.push(`Identified Risks:\n` + a.risks.map(r => `- [${r.id}] ${r.risk} (Impact: ${r.impact}, Mitigation: ${r.mitigation})`).join('\n'));
  }

  if (a.contentType === 'coding' && a.codeGuide) {
    blocks.push(`Technical Guide:\n${a.codeGuide}`);
  }

  return blocks.join('\n\n');
}

export async function generateGroundedRAGAnswer(
  query: string,
  meeting: Meeting,
  chatHistory: { sender: 'user' | 'assistant'; text: string }[] = []
): Promise<string> {
  console.log('\n=========================================================');
  console.log(`[RAG TRACE] Question Received: "${query}"`);
  console.log(`[RAG TRACE] Target Meeting ID: "${meeting.id}" | Title: "${meeting.title}"`);
  console.log('=========================================================');

  const index = indexMeetingContext(meeting);
  const retrievedChunks = retrieveContextChunks(query, index.chunks, 6);

  console.log(`[RAG TRACE] Retrieved ${retrievedChunks.length} Context Chunks:`);
  retrievedChunks.forEach((c, idx) => {
    console.log(`  [Chunk ${idx + 1}] ID: ${c.id} | Timestamp: [${c.timestamp}] | Speaker: ${c.speaker}`);
    console.log(`             Content: "${c.text.slice(0, 100)}${c.text.length > 100 ? '...' : ''}"`);
  });

  const contextSnippet = retrievedChunks.length > 0
    ? retrievedChunks.map(c => `[${c.timestamp}] ${c.speaker}: "${c.text}"`).join('\n')
    : 'No direct dialogue chunk matched the query keywords.';

  const structuredContext = buildStructuredContextBlock(meeting);
  const memoryText = chatHistory.slice(-4).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

  const systemPrompt = `You are the AI Copilot for the recording "${meeting.title}".

STRICT GUIDELINES:
1. Answer ONLY the specific question asked: "${query}".
2. DO NOT provide a general meeting summary unless explicitly asked to summarize.
3. If the question is about this meeting, reference specific speakers and include timestamp citations (e.g. "[02:15] Speaker 1 stated...") and use ONLY the Structured Facts and Relevant Transcript Chunks below.
4. If the question is unrelated to this meeting (general knowledge, casual conversation, coding help, etc.), ignore the transcript context and just answer it directly and helpfully, like a normal chatbot would.
5. Only if the question is clearly ABOUT the meeting but the answer isn't covered by the transcript or facts below, say so plainly: "I couldn't find specific discussion details about this in the recording."

Structured Meeting Facts:
${structuredContext || 'None'}

Relevant Transcript Chunks:
${contextSnippet}

Recent Conversation History:
${memoryText || 'None'}`;

  console.log('[RAG TRACE] Prompt Construction complete. Sending request to LLM...');

  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  // NOTE: there used to be a "Llama API" tier here pointed at
  // https://api.llama-api.com. It's been removed — the configured
  // LLAMA_API_KEY is an LlamaCloud (LlamaIndex) key, valid only against
  // api.cloud.llamaindex.ai for document-extraction jobs (see
  // lib/llamaCloud.ts), not a chat-completions endpoint. That tier always
  // 404'd, silently wasted a network round trip on every single chat
  // message, and fell straight through to the fallback below regardless —
  // which is why every question looked like it got the same canned answer.

  // 1. Try NVIDIA Nemotron / NIM API
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
      if (responseText.trim() !== '') {
        console.log('[RAG TRACE] LLM Response received from NVIDIA Nemotron.');
        return responseText;
      }
    } catch (err: any) {
      console.warn('[RAG Engine] NVIDIA Nemotron API notice:', err.message);
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
      if (responseText.trim() !== '') {
        console.log('[RAG TRACE] LLM Response received from Anthropic API.');
        return responseText;
      }
    } catch (err: any) {
      console.warn('[RAG Engine] Anthropic API error:', err.message);
    }
  }

  // 4. Grounded Dynamic RAG Fallback Generator
  console.log('[RAG TRACE] Using Grounded Dynamic RAG Fallback Engine.');
  return fallbackGroundedRAG(query, meeting, index, retrievedChunks);
}

// ---------------------------------------------------------------------------
// DYNAMIC GROUNDED RAG FALLBACK GENERATOR (SPECIFIC QUERY ANSWERING)
// ---------------------------------------------------------------------------
function fallbackGroundedRAG(
  query: string,
  meeting: Meeting,
  index: ContextualMeetingIndex,
  retrievedChunks: SemanticChunk[]
): string {
  const queryLower = query.toLowerCase();

  // These category branches dump the FULL list from meeting.analysis, so
  // they must only fire when the question is clearly asking for an overview
  // of that category — not merely mentioning a related word. ("who", "task",
  // "issue" etc. show up in almost every question, so using them alone as
  // triggers made most distinct questions collapse onto the same canned
  // list — that was the "same answer for any question" bug.)
  const asksForOverview = /\b(list|all|every|what are|show me|give me)\b/.test(queryLower);

  // 1. Decisions overview
  if (asksForOverview && /decision/.test(queryLower)) {
    if (meeting.analysis?.decisions && meeting.analysis.decisions.length > 0) {
      const decList = meeting.analysis.decisions.map(d => `• **${d.decision}** (Decided by: ${d.decider} — ${d.context})`).join('\n');
      return `Based on the recording "${meeting.title}", here are the decisions recorded:\n\n${decList}`;
    }
  }

  // 2. Action items / tasks overview
  if (asksForOverview && /(action item|\btask)/.test(queryLower)) {
    if (meeting.analysis?.actionItems && meeting.analysis.actionItems.length > 0) {
      const actList = meeting.analysis.actionItems.map(x => `• **${x.task}** — Assigned to: **${x.assignee}** (Due: ${x.dueDate}, Status: ${x.status})`).join('\n');
      return `Based on the recording "${meeting.title}", here are the action item assignments:\n\n${actList}`;
    }
  }

  // 3. Risks / blockers overview
  if (asksForOverview && /(risk|blocker)/.test(queryLower)) {
    if (meeting.analysis?.risks && meeting.analysis.risks.length > 0) {
      const riskList = meeting.analysis.risks.map(r => `• **${r.risk}** — Impact: **${r.impact}** (Mitigation: ${r.mitigation})`).join('\n');
      return `Based on the recording "${meeting.title}", here are the identified risks:\n\n${riskList}`;
    }
  }

  // 4. Speaker / participant list — a narrower, unambiguous phrase match
  if (/\b(speakers?|participants?|who (was|is|were) (in|on|part of|attending))\b/.test(queryLower)) {
    if (index.speakers.length > 0) {
      const speakerList = index.speakers.map(s => `• **${s}**`).join('\n');
      return `There were **${index.speakers.length} speaker(s)** active in "${meeting.title}":\n\n${speakerList}`;
    }
  }

  // 5. Primary path — answer from the transcript chunks retrieved
  // specifically for THIS question (TF-IDF + keyword overlap against the
  // query), so different questions actually get different answers.
  if (retrievedChunks.length > 0) {
    const dialogueLines = retrievedChunks.map(c => `• [${c.timestamp}] **${c.speaker}**: "${c.text}"`).join('\n\n');
    return `Here's what the transcript of "${meeting.title}" says relevant to "${query}":\n\n${dialogueLines}`;
  }

  // 6. Nothing in the transcript matches this question at all. Say so
  // honestly instead of a generic non-answer, and point at how to unlock
  // real general-purpose chat (this fallback can only ever answer from the
  // transcript — it can't improvise a general-knowledge answer the way an
  // actual LLM tier above can).
  return `I couldn't find anything in this meeting's transcript about "${query}". This assistant is currently running in transcript-only fallback mode (no NVIDIA_API_KEY or ANTHROPIC_API_KEY configured) — add one of those to also get general-purpose chatbot answers for questions unrelated to the recording.`;
}
