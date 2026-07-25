import Anthropic from '@anthropic-ai/sdk';
import { runLlamaCloudExtraction } from './llamaCloud';

export type ContentType = 'meeting' | 'lecture' | 'coding' | 'podcast' | 'general';

export interface ContentClassification {
  contentType: ContentType;
  confidence: number;
  reasoning?: string;
}

const VALID_TYPES: ContentType[] = ['meeting', 'lecture', 'coding', 'podcast', 'general'];

function isValidType(value: any): value is ContentType {
  return typeof value === 'string' && VALID_TYPES.includes(value as ContentType);
}

const CLASSIFY_SYSTEM_PROMPT = `You are a content classifier for an audio/meeting intelligence platform.
Classify the transcript into EXACTLY ONE of these categories:
- "meeting": business/work meetings, standups, syncs, planning or status discussions with decisions, action items, or multiple participants coordinating work.
- "lecture": educational or instructional content — a single speaker (or teacher/student dynamic) teaching or explaining concepts, academic or training material.
- "coding": software development content — code walkthroughs, technical tutorials, discussion of APIs, libraries, tools, commands, architecture.
- "podcast": informal long-form conversation or monologue — interview-style discussion, storytelling, commentary, entertainment, AND ALSO motivational/inspirational talks, keynote speeches, self-help or mindset content; not task/decision oriented.
- "general": anything that doesn't clearly fit the above, or a short/ambiguous transcript.

Respond with ONLY a valid JSON object, no commentary:
{ "contentType": "meeting" | "lecture" | "coding" | "podcast" | "general", "confidence": 0-100, "reasoning": "one short sentence" }`;

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    contentType: {
      type: 'string',
      enum: ['meeting', 'lecture', 'coding', 'podcast', 'general'],
      description: CLASSIFY_SYSTEM_PROMPT,
    },
    confidence: { type: 'number', description: 'Confidence in this classification, 0-100.' },
    reasoning: { type: 'string', description: 'One short sentence explaining the classification.' },
  },
  required: ['contentType', 'confidence', 'reasoning'],
};

function parseClassificationJson(text: string): ContentClassification | null {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const startIdx = clean.indexOf('{');
  const endIdx = clean.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);

  try {
    const parsed = JSON.parse(clean);
    if (isValidType(parsed.contentType)) {
      return {
        contentType: parsed.contentType,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 60,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
      };
    }
  } catch (_) {}
  return null;
}

export async function classifyContentType(transcript: string): Promise<ContentClassification> {
  const trimmed = (transcript || '').trim();
  if (!trimmed || trimmed.length < 20) {
    return { contentType: 'general', confidence: 30, reasoning: 'Transcript too short to classify confidently.' };
  }

  // Classification only needs enough signal to identify the genre, not the
  // full transcript — keeping the prompt small keeps this call fast and cheap.
  const sample = trimmed.length > 6000 ? trimmed.slice(0, 6000) : trimmed;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  // 1. LlamaCloud Extract — the only AI backend that actually works with the
  // configured LLAMA_API_KEY (see lib/llamaCloud.ts for why the previous
  // api.llama-api.com chat-completion approach never worked).
  const llamaResult = await runLlamaCloudExtraction(sample, CLASSIFY_SCHEMA);
  if (llamaResult && isValidType(llamaResult.contentType)) {
    return {
      contentType: llamaResult.contentType,
      confidence: typeof llamaResult.confidence === 'number' ? Math.max(0, Math.min(100, llamaResult.confidence)) : 70,
      reasoning: typeof llamaResult.reasoning === 'string' ? llamaResult.reasoning : undefined,
    };
  }

  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 200,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Transcript:\n\n${sample}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = parseClassificationJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.error('[Classify] Anthropic classification failed:', err.message);
    }
  }

  return heuristicClassify(trimmed);
}

const KEYWORD_WEIGHTS: Record<Exclude<ContentType, 'general'>, string[]> = {
  meeting: [
    'action item', "let's decide", 'decision', 'assign', 'follow up', 'standup', 'stand-up',
    'sync up', 'blocker', 'deadline', 'sprint', 'roadmap', 'stakeholder', 'agenda', 'next steps',
  ],
  lecture: [
    'today we will', 'today we\'ll', 'chapter', 'concept', 'definition', 'for example',
    "let's understand", 'in this lesson', 'homework', 'exam', 'syllabus', 'professor', 'students',
    'assignment', 'lecture',
  ],
  coding: [
    'function', 'variable', 'import ', 'npm install', 'git ', 'repository', 'api key', 'endpoint',
    'database', 'algorithm', 'compile', 'debug', 'pull request', 'const ', 'class ', 'framework',
    'library', 'dependency', 'json', 'localhost',
  ],
  podcast: [
    'welcome back', "today's guest", 'subscribe', 'this episode', 'my guest', 'interview',
    'welcome to the show', 'stay tuned', 'thanks for listening', 'hit subscribe',
    // motivational/inspirational talks and keynote speeches fold into the podcast bucket
    'believe in yourself', 'never give up', 'your dreams', 'unlock your potential',
    'i want you to', 'imagine if you', 'change your life', 'take action today',
    'success is', 'greatness', 'motivation', 'inspire', 'mindset',
  ],
};

function heuristicClassify(transcript: string): ContentClassification {
  const lower = transcript.toLowerCase();
  const scores: Record<Exclude<ContentType, 'general'>, number> = { meeting: 0, lecture: 0, coding: 0, podcast: 0 };

  (Object.keys(KEYWORD_WEIGHTS) as Array<Exclude<ContentType, 'general'>>).forEach((cat) => {
    KEYWORD_WEIGHTS[cat].forEach((kw) => {
      if (lower.includes(kw)) scores[cat] += 1;
    });
  });

  // Speaker turn-taking signal: many short alternating speaker turns reads as
  // a meeting; long unbroken stretches from one speaker reads as lecture/podcast.
  const speakerTurns = transcript.match(/^\[?\d{0,2}:?\d{0,2}\]?\s*[^:\n]{1,40}:/gm) || [];
  if (speakerTurns.length > 8) {
    const uniqueSpeakers = new Set(speakerTurns.map((t) => t.replace(/^\[?\d{0,2}:?\d{0,2}\]?\s*/, '').replace(/:$/, '').trim()));
    if (uniqueSpeakers.size >= 3) scores.meeting += 2;
  }

  const entries = Object.entries(scores) as Array<[Exclude<ContentType, 'general'>, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = entries[0];
  const [, secondScore] = entries[1];

  if (topScore === 0 || topScore === secondScore) {
    return { contentType: 'general', confidence: 35, reasoning: 'No clear genre signal found in transcript.' };
  }

  const confidence = Math.min(92, 45 + (topScore - secondScore) * 8);
  return { contentType: topType, confidence, reasoning: `Keyword/pattern heuristic favored "${topType}".` };
}
