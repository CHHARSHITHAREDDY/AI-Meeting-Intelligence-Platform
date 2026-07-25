import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { MeetingAnalysis } from './db';
import { FinalMeetingSummaries } from './liveMeeting';
import { runLlamaCloudExtraction } from './llamaCloud';

function normalizeMeetingAnalysis(raw: any): MeetingAnalysis {
  const decisions = (raw.decisions || []).map((d: any, idx: number) => ({
    id: d.id || `dec-${idx + 1}`,
    decision: d.decision,
    decider: d.decider || 'Team',
    context: d.context || 'Aligned on during sync.',
  }));
  const actionItems = (raw.actionItems || []).map((a: any, idx: number) => ({
    id: a.id || `act-${idx + 1}`,
    task: a.task,
    assignee: a.assignee || 'Unassigned',
    dueDate: a.dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: a.status || 'pending',
  }));
  const risks = (raw.risks || []).map((r: any, idx: number) => ({
    id: r.id || `risk-${idx + 1}`,
    risk: r.risk,
    impact: r.impact || 'medium',
    mitigation: r.mitigation || 'Monitor closely.',
  }));
  const notes = (raw.notes || []).map((n: any) => (typeof n === 'string' ? n : JSON.stringify(n)));

  return {
    summary: raw.summary || 'Summary not available.',
    keyDiscussionPoints: Array.isArray(raw.keyDiscussionPoints) ? raw.keyDiscussionPoints : undefined,
    decisions,
    actionItems,
    risks,
    nextSteps: Array.isArray(raw.nextSteps) ? raw.nextSteps : undefined,
    notes,
  };
}

/** Strips markdown code fences and extracts the outermost JSON object from an LLM response. */
function parseJsonResponse(text: string): any | null {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  const startIdx = clean.indexOf('{');
  const endIdx = clean.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    clean = clean.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (_) {
    return null;
  }
}

/**
 * Shared single-call structured extraction (NVIDIA Nemotron -> LlamaCloud -> Anthropic), used by
 * the type-specific extractors below.
 */
async function runStructuredExtraction(transcript: string, systemPrompt: string, schema: object): Promise<any | null> {
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Using NVIDIA Nemotron / NIM API for structured extraction...');
      const nvidiaClient = new OpenAI({
        apiKey: nvidiaApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });

      const response = await nvidiaClient.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transcript:\n\n${transcript}` },
        ],
      });

      const text = response.choices[0]?.message?.content || '';
      const parsed = parseJsonResponse(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn('[Extract Insights] NVIDIA Nemotron API notice:', err.message);
    }
  }

  const llamaResult = await runLlamaCloudExtraction(transcript, schema);
  if (llamaResult) return llamaResult;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Transcript:\n\n${transcript}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = parseJsonResponse(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.error('[Extract Insights] Anthropic fallback failed:', err.message);
    }
  }

  return null;
}

const LECTURE_SYSTEM_PROMPT = `You are an educational content analyst. Analyze the lecture/educational transcript and respond with ONLY a valid JSON object matching:
{
  "summary": "A concise overview of what the lecture covered (2-3 sentences).",
  "notes": ["Key study note 1", "Key study note 2", "..."],
  "flashcards": [{ "question": "A study question derived from the content.", "answer": "The answer." }],
  "mindmap": { "topic": "Main subject of the lecture", "children": [{ "topic": "Sub-topic", "children": [{ "topic": "Detail point" }] }] },
  "quiz": [{ "question": "A comprehension question.", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "Why this is correct." }]
}
Produce 5-10 notes, 5-8 flashcards, a mindmap with 3-6 top-level branches, and 4-6 quiz questions. Do not include any text before or after the JSON.`;

const LECTURE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'A concise overview of what the lecture covered (2-3 sentences).' },
    notes: { type: 'array', description: '5-10 key study notes.', items: { type: 'string' } },
    flashcards: {
      type: 'array',
      description: '5-8 study flashcards.',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer'],
      },
    },
    mindmap: {
      type: 'object',
      description: 'A nested topic outline of the lecture, 3-6 top-level branches.',
      properties: {
        topic: { type: 'string' },
        children: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              children: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' } } } },
            },
          },
        },
      },
    },
    quiz: {
      type: 'array',
      description: '4-6 multiple-choice comprehension questions.',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'number', description: 'Index into options of the correct answer.' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correctIndex'],
      },
    },
  },
  required: ['summary', 'notes', 'flashcards', 'quiz'],
};

const CODING_SYSTEM_PROMPT = `You are a software engineering content analyst. Analyze the coding/technical transcript and respond with ONLY a valid JSON object matching:
{
  "summary": "A concise overview of what was built/discussed (2-3 sentences).",
  "codeGuide": "A step-by-step walkthrough of the implementation discussed, formatted as short numbered steps using \\n for line breaks.",
  "apis": [{ "name": "API or endpoint name", "description": "What it's used for." }],
  "libraries": [{ "name": "Library/package name", "purpose": "Why it's used." }],
  "commands": [{ "command": "Exact CLI command mentioned or implied.", "description": "What it does." }]
}
Only include APIs/libraries/commands actually mentioned or clearly implied by the transcript. If none are found for a category, return an empty array. Do not include any text before or after the JSON.`;

const CODING_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'A concise overview of what was built/discussed (2-3 sentences).' },
    codeGuide: { type: 'string', description: 'A step-by-step walkthrough of the implementation discussed, as numbered steps separated by newlines.' },
    apis: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'description'] },
    },
    libraries: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, purpose: { type: 'string' } }, required: ['name', 'purpose'] },
    },
    commands: {
      type: 'array',
      items: { type: 'object', properties: { command: { type: 'string' }, description: { type: 'string' } }, required: ['command', 'description'] },
    },
  },
  required: ['summary', 'apis', 'libraries', 'commands'],
};

const PODCAST_SYSTEM_PROMPT = `You are a podcast/long-form content analyst. Analyze the conversational transcript and respond with ONLY a valid JSON object matching:
{
  "summary": "A concise overview of the episode/conversation (2-3 sentences).",
  "keyInsights": ["A notable insight or takeaway from the conversation.", "..."],
  "timeline": [{ "timestamp": "Approximate timestamp from the transcript, e.g. 00:05", "topic": "What was being discussed at that point." }],
  "resources": [{ "name": "Book/tool/link/person mentioned.", "type": "book | tool | link | person | other", "reference": "Any URL or citation mentioned, if any." }]
}
Produce 4-8 key insights and a timeline covering the major topic shifts. Do not include any text before or after the JSON.`;

const PODCAST_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'A concise overview of the episode/conversation (2-3 sentences).' },
    keyInsights: { type: 'array', description: '4-8 notable insights or takeaways.', items: { type: 'string' } },
    timeline: {
      type: 'array',
      description: 'Major topic shifts with approximate timestamps.',
      items: { type: 'object', properties: { timestamp: { type: 'string' }, topic: { type: 'string' } }, required: ['timestamp', 'topic'] },
    },
    resources: {
      type: 'array',
      description: 'Books, tools, links, or people mentioned.',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, type: { type: 'string', enum: ['book', 'tool', 'link', 'person', 'other'] }, reference: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  required: ['summary', 'keyInsights'],
};

function emptyMeetingFields() {
  return { decisions: [], actionItems: [], risks: [] };
}

export async function extractLectureInsights(transcript: string): Promise<MeetingAnalysis> {
  const raw = await runStructuredExtraction(transcript, LECTURE_SYSTEM_PROMPT, LECTURE_SCHEMA);
  if (raw) {
    return {
      summary: raw.summary || 'Summary not available.',
      notes: Array.isArray(raw.notes) ? raw.notes.map((n: any) => (typeof n === 'string' ? n : JSON.stringify(n))) : [],
      flashcards: Array.isArray(raw.flashcards) ? raw.flashcards : [],
      mindmap: raw.mindmap && typeof raw.mindmap === 'object' ? raw.mindmap : undefined,
      quiz: Array.isArray(raw.quiz) ? raw.quiz : [],
      ...emptyMeetingFields(),
    };
  }
  return localLectureHeuristic(transcript);
}

export async function extractCodingInsights(transcript: string): Promise<MeetingAnalysis> {
  const raw = await runStructuredExtraction(transcript, CODING_SYSTEM_PROMPT, CODING_SCHEMA);
  if (raw) {
    return {
      summary: raw.summary || 'Summary not available.',
      codeGuide: typeof raw.codeGuide === 'string' ? raw.codeGuide : undefined,
      apis: Array.isArray(raw.apis) ? raw.apis : [],
      libraries: Array.isArray(raw.libraries) ? raw.libraries : [],
      commands: Array.isArray(raw.commands) ? raw.commands : [],
      ...emptyMeetingFields(),
    };
  }
  return localCodingHeuristic(transcript);
}

export async function extractPodcastInsights(transcript: string): Promise<MeetingAnalysis> {
  const raw = await runStructuredExtraction(transcript, PODCAST_SYSTEM_PROMPT, PODCAST_SCHEMA);
  if (raw) {
    return {
      summary: raw.summary || 'Summary not available.',
      keyInsights: Array.isArray(raw.keyInsights) ? raw.keyInsights : [],
      timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
      resources: Array.isArray(raw.resources) ? raw.resources : [],
      ...emptyMeetingFields(),
    };
  }
  return localPodcastHeuristic(transcript);
}

function splitSentences(transcript: string): string[] {
  return (transcript.match(/[^.!?]+[.!?]+/g) || [transcript]).map((s) => s.trim()).filter((s) => s.length > 4);
}

function localLectureHeuristic(transcript: string): MeetingAnalysis {
  const sentences = splitSentences(transcript);
  const summary = sentences.slice(0, 3).join(' ') || 'Lecture content summary unavailable.';
  const notes = sentences.slice(0, 8);
  const flashcards = notes.slice(0, 5).map((s) => ({
    question: `What does the lecture say about: "${s.slice(0, 60)}${s.length > 60 ? '...' : ''}"?`,
    answer: s,
  }));
  const topics = notes.slice(0, 5).map((s) => ({ topic: s.slice(0, 50) }));
  return {
    summary,
    notes,
    flashcards,
    mindmap: { topic: 'Lecture Overview', children: topics },
    quiz: [],
    ...emptyMeetingFields(),
  };
}

function localCodingHeuristic(transcript: string): MeetingAnalysis {
  const sentences = splitSentences(transcript);
  const summary = sentences.slice(0, 3).join(' ') || 'Technical discussion summary unavailable.';
  const codeGuide = sentences.slice(0, 6).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const libraryMatches = Array.from(new Set((transcript.match(/\b[a-z][a-z0-9-]{2,}(?:\.js|\.py)?\b/gi) || [])
    .filter((w) => ['react', 'next', 'node', 'express', 'django', 'flask', 'vue', 'angular', 'tailwind', 'postgres', 'mongodb', 'redis', 'docker', 'kubernetes'].includes(w.toLowerCase()))));
  const commandMatches = (transcript.match(/\b(npm|git|docker|yarn|pip)\s+[a-z-]+(?:\s+[^\s.,;]+)?/gi) || []).slice(0, 8);
  return {
    summary,
    codeGuide,
    apis: [],
    libraries: libraryMatches.map((name) => ({ name, purpose: 'Mentioned during the technical discussion.' })),
    commands: Array.from(new Set(commandMatches)).map((command) => ({ command, description: 'Command referenced in the discussion.' })),
    ...emptyMeetingFields(),
  };
}

function localPodcastHeuristic(transcript: string): MeetingAnalysis {
  const sentences = splitSentences(transcript);
  const summary = sentences.slice(0, 3).join(' ') || 'Episode summary unavailable.';
  const keyInsights = sentences.slice(0, 6);
  const lines = transcript.split('\n').map((l) => l.trim()).filter(Boolean);
  const timeline = lines.slice(0, 6).map((line, idx) => {
    const match = line.match(/^\[?(\d{1,2}:\d{2})\]?/);
    return { timestamp: match ? match[1] : `${idx * 2}:00`, topic: line.replace(/^\[?\d{1,2}:\d{2}\]?\s*/, '').slice(0, 80) };
  });
  return {
    summary,
    keyInsights,
    timeline,
    resources: [],
    ...emptyMeetingFields(),
  };
}

const MEETING_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).' },
    keyDiscussionPoints: { type: 'array', description: 'Main discussion topics or key points explored during the meeting.', items: { type: 'string' } },
    decisions: {
      type: 'array',
      description: 'List of decisions reached in the meeting.',
      items: {
        type: 'object',
        properties: {
          decision: { type: 'string', description: 'The decision made.' },
          decider: { type: 'string', description: 'Who made the decision.' },
          context: { type: 'string', description: 'Context or reasoning behind the decision.' },
        },
        required: ['decision', 'decider', 'context'],
      },
    },
    actionItems: {
      type: 'array',
      description: 'List of action items or tasks assigned to people.',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The specific task description.' },
          assignee: { type: 'string', description: 'Who is responsible for the task.' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format (estimate if not explicitly stated).' },
        },
        required: ['task', 'assignee', 'dueDate'],
      },
    },
    risks: {
      type: 'array',
      description: 'List of risks or warnings discussed.',
      items: {
        type: 'object',
        properties: {
          risk: { type: 'string', description: 'Description of the risk identified.' },
          impact: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Impact level of the risk.' },
          mitigation: { type: 'string', description: 'How the risk will be mitigated or resolved.' },
        },
        required: ['risk', 'impact', 'mitigation'],
      },
    },
    nextSteps: { type: 'array', description: 'Clear next steps or follow-up actions planned.', items: { type: 'string' } },
    notes: { type: 'array', description: 'Important key notes, warnings, guidelines, or deadlines mentioned.', items: { type: 'string' } },
  },
  required: ['summary', 'decisions', 'actionItems', 'risks'],
};

export async function extractMeetingInsights(transcript: string): Promise<MeetingAnalysis> {
<<<<<<< HEAD
=======
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  const llamaApiKey = process.env.LLAMA_API_KEY;
>>>>>>> 96777e4 (feat: add Google-style floating interactive media dock, animated badges, and Nemotron AI integration)
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  const systemPrompt = `You are a professional meeting intelligence analyst.
Analyze the provided meeting transcript and extract structured intelligence in JSON format.
You must respond with ONLY a valid, parseable JSON object matching this schema:
{
  "summary": "An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).",
  "keyDiscussionPoints": [
    "First main discussion topic or key point explored during the meeting.",
    "Second main discussion topic or key point explored during the meeting."
  ],
  "decisions": [
    {
      "id": "dec-1",
      "decision": "The decision made.",
      "decider": "Who made the decision.",
      "context": "Context or reasoning behind the decision."
    }
  ],
  "actionItems": [
    {
      "id": "act-1",
      "task": "The specific task description.",
      "assignee": "Who is responsible for the task.",
      "dueDate": "YYYY-MM-DD format (estimate if not explicitly stated, base on current date context 2026-07-24).",
      "status": "pending"
    }
  ],
  "risks": [
    {
      "id": "risk-1",
      "risk": "Description of the risk identified.",
      "impact": "low" | "medium" | "high",
      "mitigation": "How the risk will be mitigated or resolved."
    }
  ],
  "nextSteps": [
    "Clear next step or follow-up action planned.",
    "Target milestone or upcoming check-in."
  ],
  "notes": [
    "Important takeaway or callout from the meeting."
  ]
}

Ensure all JSON keys and values are properly formatted. Do not include any text before or after the JSON.`;

<<<<<<< HEAD
  // 1. LlamaCloud Extract — the only AI backend that actually works with the
  // configured LLAMA_API_KEY (see lib/llamaCloud.ts). An earlier version of
  // this function called api.llama-api.com with this key, which always
  // rejected it ("ApiToken not found") and silently fell through to the
  // heuristic parser on every single call — every upload's summary was
  // effectively regex-generated regardless of quality expectations.
  console.log('[Extract Insights] Requesting structured extraction from LlamaCloud...');
  const raw = await runLlamaCloudExtraction(transcript, MEETING_SCHEMA);
  if (raw) {
    console.log('[Extract Insights] LlamaCloud extraction succeeded.');
    return normalizeMeetingAnalysis(raw);
=======
  // 1. Try NVIDIA Nemotron / NIM API first if key is present
  if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Performing structured extraction using NVIDIA Nemotron / NIM API...');
      const nvidiaClient = new OpenAI({
        apiKey: nvidiaApiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });

      const response = await nvidiaClient.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the meeting transcript:\n\n${transcript}` },
        ],
      });

      const text = response.choices[0]?.message?.content || '';
      let cleanJsonText = text.trim();
      if (cleanJsonText.startsWith('```json')) cleanJsonText = cleanJsonText.slice(7);
      else if (cleanJsonText.startsWith('```')) cleanJsonText = cleanJsonText.slice(3);
      if (cleanJsonText.endsWith('```')) cleanJsonText = cleanJsonText.slice(0, -3);
      cleanJsonText = cleanJsonText.trim();

      const startIdx = cleanJsonText.indexOf('{');
      const endIdx = cleanJsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        cleanJsonText = cleanJsonText.substring(startIdx, endIdx + 1);
      }

      const parsed: MeetingAnalysis = JSON.parse(cleanJsonText);
      if (parsed.decisions) {
        parsed.decisions = parsed.decisions.map((d, i) => ({ ...d, id: d.id || `dec-${i + 1}` }));
      } else {
        parsed.decisions = [];
      }
      if (parsed.actionItems) {
        parsed.actionItems = parsed.actionItems.map((a, i) => ({ ...a, id: a.id || `act-${i + 1}`, status: a.status || 'pending' }));
      } else {
        parsed.actionItems = [];
      }
      if (parsed.risks) {
        parsed.risks = parsed.risks.map((r, i) => ({ ...r, id: r.id || `risk-${i + 1}` }));
      } else {
        parsed.risks = [];
      }
      if (parsed.notes) {
        parsed.notes = parsed.notes.map(n => typeof n === 'string' ? n : JSON.stringify(n));
      } else {
        parsed.notes = [];
      }

      console.log('[Extract Insights] NVIDIA Nemotron extraction succeeded!');
      return parsed;
    } catch (err: any) {
      console.warn('[Extract Insights] NVIDIA Nemotron API error, trying next provider:', err.message);
    }
  }

  // 1. Try LlamaCloud Extraction API first if key is present
  if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Performing structured extraction using LlamaCloud API...');
      
      // Step A: Fetch project ID dynamically
      let projectId = 'f8c2f134-1828-4029-b3a5-778e2b70f421'; // Default project fallback
      try {
        console.log('[Extract Insights] Fetching LlamaCloud projects...');
        const projRes = await fetch('https://api.cloud.llamaindex.ai/api/v1/projects', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${llamaApiKey}` }
        });
        if (projRes.ok) {
          const projects = await projRes.json();
          if (projects && projects.length > 0) {
            projectId = projects[0].id;
            console.log('[Extract Insights] Found project ID:', projectId);
          }
        }
      } catch (err: any) {
        console.warn('[Extract Insights] Failed to fetch projects list, using default project ID:', err.message);
      }

      // Step B: Upload transcript text file
      console.log('[Extract Insights] Uploading transcript to LlamaCloud...');
      const formData = new FormData();
      const blob = new Blob([transcript], { type: 'text/plain' });
      formData.append('file', blob, 'transcript.txt');
      formData.append('purpose', 'extract');

      const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/v1/beta/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${llamaApiKey}` },
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status} - ${await uploadRes.text()}`);
      }

      const uploadData = await uploadRes.json();
      const fileId = uploadData.id;
      console.log('[Extract Insights] File uploaded successfully. File ID:', fileId);

      // Wait a short moment to ensure registration on LlamaCloud
      await new Promise(r => setTimeout(r, 1000));

      // Step C: Trigger structured data extraction job
      console.log('[Extract Insights] Submitting extraction job...');
      const extractBody = {
        file_input: fileId,
        configuration: {
          tier: 'agentic',
          version: '2026-03-31',
          extraction_target: 'per_doc',
          data_schema: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'An executive summary of the meeting, high-level overview of key topics and outcomes (2-3 sentences).'
              },
              decisions: {
                type: 'array',
                description: 'List of decisions reached in the meeting.',
                items: {
                  type: 'object',
                  properties: {
                    decision: { type: 'string', description: 'The decision made.' },
                    decider: { type: 'string', description: 'Who made the decision.' },
                    context: { type: 'string', description: 'Context or reasoning behind the decision.' }
                  },
                  required: ['decision', 'decider', 'context']
                }
              },
              actionItems: {
                type: 'array',
                description: 'List of action items or tasks assigned to people.',
                items: {
                  type: 'object',
                  properties: {
                    task: { type: 'string', description: 'The specific task description.' },
                    assignee: { type: 'string', description: 'Who is responsible for the task.' },
                    dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format (estimate if not explicitly stated).' }
                  },
                  required: ['task', 'assignee', 'dueDate']
                }
              },
              risks: {
                type: 'array',
                description: 'List of risks or warnings discussed.',
                items: {
                  type: 'object',
                  properties: {
                    risk: { type: 'string', description: 'Description of the risk identified.' },
                    impact: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Impact level of the risk.' },
                    mitigation: { type: 'string', description: 'How the risk will be mitigated or resolved.' }
                  },
                  required: ['risk', 'impact', 'mitigation']
                }
              },
              notes: {
                type: 'array',
                description: 'List of important key notes, warnings, guidelines, or deadlines mentioned.',
                items: { type: 'string' }
              }
            },
            required: ['summary', 'decisions', 'actionItems', 'risks', 'notes']
          }
        }
      };

      const extractRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract?project_id=${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${llamaApiKey}`
        },
        body: JSON.stringify(extractBody)
      });

      if (!extractRes.ok) {
        throw new Error(`Job submission failed: ${extractRes.status} - ${await extractRes.text()}`);
      }

      const extractJob = await extractRes.json();
      const jobId = extractJob.id;
      console.log('[Extract Insights] Job submitted successfully. Job ID:', jobId);

      // Step D: Poll for extraction results
      let attempts = 0;
      let extractResult: any = null;

      while (attempts < 15) {
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[Extract Insights] Polling LlamaCloud job status (attempt ${attempts + 1})...`);
        
        const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/v2/extract/${jobId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${llamaApiKey}` }
        });

        if (!statusRes.ok) {
          throw new Error(`Job status check failed: ${statusRes.status} - ${await statusRes.text()}`);
        }

        const statusData = await statusRes.json();
        const status = statusData.status?.toUpperCase();

        if (status === 'COMPLETED' || status === 'SUCCESS') {
          extractResult = statusData.extract_result;
          console.log('[Extract Insights] Structured extraction completed successfully!');
          break;
        } else if (status === 'FAILED') {
          throw new Error(`LlamaCloud extraction job failed on server side: ${statusData.error_message}`);
        }
        attempts++;
      }

      if (extractResult) {
        const parsed: MeetingAnalysis = {
          summary: extractResult.summary || 'Summary not available.',
          decisions: (extractResult.decisions || []).map((d: any, idx: number) => ({
            id: d.id || `dec-${idx + 1}`,
            decision: d.decision,
            decider: d.decider || 'Team',
            context: d.context || 'Aligned on during sync.'
          })),
          actionItems: (extractResult.actionItems || []).map((a: any, idx: number) => ({
            id: a.id || `act-${idx + 1}`,
            task: a.task,
            assignee: a.assignee || 'Unassigned',
            dueDate: a.dueDate || new Date(Date.now() + 7*24*3600*1000).toISOString().split('T')[0],
            status: a.status || 'pending'
          })),
          risks: (extractResult.risks || []).map((r: any, idx: number) => ({
            id: r.id || `risk-${idx + 1}`,
            risk: r.risk,
            impact: r.impact || 'medium',
            mitigation: r.mitigation || 'Monitor closely.'
          })),
          notes: extractResult.notes || []
        };
        return parsed;
      }
    } catch (err: any) {
      console.error('[Extract Insights] LlamaCloud extraction pipeline failed:', err.message);
    }
>>>>>>> 96777e4 (feat: add Google-style floating interactive media dock, animated badges, and Nemotron AI integration)
  }
  console.warn('[Extract Insights] LlamaCloud extraction unavailable, falling back...');

  // 2. Fallback to Anthropic if LlamaCloud failed/was missing, and an Anthropic key is present
  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      console.log('[Extract Insights] Falling back to Anthropic (Claude)...');
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Here is the meeting transcript:\n\n${transcript}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const raw = parseJsonResponse(text);
      if (raw) {
        return normalizeMeetingAnalysis(raw);
      }
    } catch (err: any) {
      console.error('[Extract Insights] Anthropic fallback failed:', err.message);
    }
  }

  // 3. Fallback to local heuristic parser if both failed/are missing
  console.log('[Extract Insights] No active API key succeeded. Using local heuristic parser fallback...');
  return localHeuristicParser(transcript);
}

function localHeuristicParser(transcript: string): MeetingAnalysis {

  // -------------------------------------------------------------
  // DYNAMIC HEURISTIC PARSING FOR TRANSCRIPT CONTENT
  // -------------------------------------------------------------
  const lines = transcript
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const cleanLine = (text: string) => {
    return text.replace(/^\[\d{2}:\d{2}\]\s*[^:]+:\s*/i, '').trim();
  };

  const sentences: string[] = [];
  const lineDetails: { speaker: string; text: string }[] = [];

  lines.forEach(line => {
    const speakerMatch = line.match(/^\[\d{2}:\d{2}\]\s*([^:]+):\s*(.*)/i);
    let speaker = 'Participant';
    let text = line;
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      text = speakerMatch[2].trim();
    } else {
      text = cleanLine(line);
    }
    lineDetails.push({ speaker, text });

    const matches = text.match(/[^.!?]+[.!?]+/g) || [text];
    matches.forEach(s => {
      const trimmed = s.trim();
      if (trimmed.length > 4) {
        sentences.push(trimmed);
      }
    });
  });

  if (sentences.length === 0) {
    sentences.push(transcript.slice(0, 100));
  }

  // Executive Summary (first 3 sentences)
  const firstThree = sentences.slice(0, 3).join(' ');
  const summary = firstThree.length > 20 ? firstThree : "Discussion overview and alignment on project deliverables based on the meeting transcript.";

  // Key Discussion Points (extending top themes)
  const keyDiscussionPoints: string[] = [];
  sentences.forEach((s, idx) => {
    if (idx % 2 === 0 && keyDiscussionPoints.length < 5 && s.length > 15) {
      keyDiscussionPoints.push(s);
    }
  });
  if (keyDiscussionPoints.length === 0) {
    keyDiscussionPoints.push("Key themes and topics explored during the meeting sync.");
  }

  // Decisions
  const decisions: { id: string; decision: string; decider: string; context: string }[] = [];
  const decisionKeywords = ['decid', 'agree', 'choose', 'select', 'favor', 'prefer', 'standard', 'policy', 'favorite', 'like'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = decisionKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && decisions.length < 5) {
      const detail = lineDetails[idx];
      decisions.push({
        id: `dec-local-${decisions.length + 1}`,
        decision: textClean,
        decider: detail.speaker,
        context: `Agreed upon during the live conversation.`
      });
    }
  });

  if (decisions.length === 0) {
    decisions.push({
      id: "dec-local-1",
      decision: sentences[Math.floor(sentences.length / 2)] || "General discussion alignment",
      decider: lineDetails[0]?.speaker || "Team",
      context: "Derived from discussion topics."
    });
  }

  // Action Items
  const actionItems: { id: string; task: string; assignee: string; dueDate: string; status: 'pending' | 'completed' }[] = [];
  const actionKeywords = ['will', 'need to', 'should', 'must', 'action', 'task', 'todo', 'assign', 'schedule', 'own', 'work on', 'follow up', 'implement'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = actionKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && actionItems.length < 6) {
      const detail = lineDetails[idx];
      actionItems.push({
        id: `act-local-${actionItems.length + 1}`,
        task: textClean,
        assignee: detail.speaker,
        dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: 'pending'
      });
    }
  });

  if (actionItems.length === 0) {
    actionItems.push({
      id: "act-local-1",
      task: sentences[Math.min(1, sentences.length - 1)] || "Review sync notes",
      assignee: lineDetails[0]?.speaker || "All",
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'pending'
    });
  }

  // Risks
  const risks: { id: string; risk: string; impact: 'low' | 'medium' | 'high'; mitigation: string }[] = [];
  const riskKeywords = ['risk', 'issue', 'problem', 'fail', 'delay', 'danger', 'concern', 'worry', 'threat', 'lag', 'vulnerability', 'bottleneck'];
  
  lines.forEach((line, idx) => {
    const textClean = cleanLine(line);
    const hasKeyword = riskKeywords.some(kw => textClean.toLowerCase().includes(kw));
    if (hasKeyword && risks.length < 5) {
      const impact: 'low' | 'medium' | 'high' = textClean.toLowerCase().includes('high') || textClean.toLowerCase().includes('severe') ? 'high' : 'medium';
      risks.push({
        id: `risk-local-${risks.length + 1}`,
        risk: textClean,
        impact,
        mitigation: `Monitor this topic closely and implement preventative checks.`
      });
    }
  });

  if (risks.length === 0) {
    risks.push({
      id: "risk-local-1",
      risk: sentences[sentences.length - 1] || "Unstructured discussion items",
      impact: "medium",
      mitigation: "Document detailed criteria to clarify intent."
    });
  }

  // Next Steps
  const nextSteps: string[] = [];
  actionItems.forEach(item => {
    nextSteps.push(`${item.assignee} to complete "${item.task}" by ${item.dueDate}.`);
  });
  if (nextSteps.length === 0) {
    nextSteps.push("Follow up on identified meeting milestones in the next team sync.");
  }

  // Unresolved Questions Extraction
  const unresolvedQuestions: string[] = [];
  lines.forEach((line) => {
    const textClean = cleanLine(line);
    if ((textClean.includes('?') || /^(how|what|who|why|when|where|can we|should we)/i.test(textClean)) && unresolvedQuestions.length < 5) {
      unresolvedQuestions.push(textClean);
    }
  });

  // Speaker Analytics Calculation
  const speakerMap = new Map<string, number>();
  let totalWords = 0;
  lineDetails.forEach(({ speaker, text }) => {
    const words = text.split(/\s+/).filter(Boolean).length;
    speakerMap.set(speaker, (speakerMap.get(speaker) || 0) + words);
    totalWords += words;
  });

  const speakerAnalytics = Array.from(speakerMap.entries()).map(([name, count]) => ({
    name,
    wordCount: count,
    talkTimePercent: totalWords > 0 ? Math.round((count / totalWords) * 100) : 0
  })).sort((a, b) => b.talkTimePercent - a.talkTimePercent);

  // Meeting Efficiency Score
  const efficiencyScore = Math.min(100, Math.max(50, Math.round(70 + decisions.length * 8 + actionItems.length * 5 - risks.length * 3)));

  return {
    summary,
    keyDiscussionPoints,
    decisions,
    actionItems,
    risks,
    nextSteps,
    notes: [],
    unresolvedQuestions,
    speakerAnalytics,
    efficiencyScore
  };
}

/**
 * Generates the three end-of-meeting summary variants (Executive Summary,
 * Technical Summary, Meeting Minutes) from the full transcript. Called once
 * when a live session ends/playback finishes, not on every incremental update.
 */
const FINAL_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    executive: { type: 'string', description: 'A concise executive summary for leadership/stakeholders: outcomes, decisions, and business impact (3-5 sentences).' },
    technical: { type: 'string', description: 'A technical summary for the engineering/implementation team: architecture, implementation details, technical tradeoffs discussed (3-6 sentences).' },
    minutes: { type: 'string', description: 'Formal meeting minutes: attendees mentioned, agenda topics covered, decisions made, and action items assigned, as a short structured list with newlines between items.' },
  },
  required: ['executive', 'technical', 'minutes'],
};

export async function generateFinalSummaries(transcript: string): Promise<FinalMeetingSummaries> {
<<<<<<< HEAD
=======
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  const llamaApiKey = process.env.LLAMA_API_KEY;
>>>>>>> 96777e4 (feat: add Google-style floating interactive media dock, animated badges, and Nemotron AI integration)
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const trimmed = (transcript || '').trim();

  if (!trimmed) {
    return {
      executive: 'No transcript was captured for this session.',
      technical: 'No transcript was captured for this session.',
      minutes: 'No transcript was captured for this session.',
    };
  }

  const finalSummarySystemPrompt = `You are a meeting intelligence analyst. Respond with ONLY a valid JSON object (no markdown fences, no commentary) matching:
{
  "executive": "A concise executive summary for leadership/stakeholders: outcomes, decisions, and business impact (3-5 sentences).",
  "technical": "A technical summary for the engineering/implementation team: architecture, implementation details, technical tradeoffs discussed (3-6 sentences).",
  "minutes": "Formal meeting minutes: attendees mentioned, agenda topics covered, decisions made, and action items assigned, formatted as a short structured list using \\n for line breaks."
}`;

  function parseFinalSummaryJson(text: string): FinalMeetingSummaries | null {
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
      if (parsed.executive && parsed.technical && parsed.minutes) return parsed as FinalMeetingSummaries;
    } catch (_) {}
    return null;
  }

<<<<<<< HEAD
  const llamaResult = await runLlamaCloudExtraction(trimmed, FINAL_SUMMARY_SCHEMA);
  if (llamaResult && llamaResult.executive && llamaResult.technical && llamaResult.minutes) {
    return llamaResult as FinalMeetingSummaries;
=======
  if (nvidiaApiKey && nvidiaApiKey.trim() !== '') {
    try {
      const client = new OpenAI({ apiKey: nvidiaApiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
      const completion = await client.chat.completions.create({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [
          { role: 'system', content: finalSummarySystemPrompt },
          { role: 'user', content: `Meeting transcript:\n\n${trimmed}` },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });
      const text = completion.choices[0]?.message?.content || '';
      const parsed = parseFinalSummaryJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.error('[Final Summaries] NVIDIA Nemotron API generation failed:', err.message);
    }
  }

  if (llamaApiKey && llamaApiKey !== 'YOUR_LLAMA_API_KEY' && llamaApiKey.trim() !== '') {
    try {
      const client = new OpenAI({ apiKey: llamaApiKey, baseURL: 'https://api.llama-api.com' });
      const completion = await client.chat.completions.create({
        model: 'llama3.1-70b',
        messages: [
          { role: 'system', content: finalSummarySystemPrompt },
          { role: 'user', content: `Meeting transcript:\n\n${trimmed}` },
        ],
        max_tokens: 1200,
      });
      const text = completion.choices[0]?.message?.content || '';
      const parsed = parseFinalSummaryJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.error('[Final Summaries] Llama API generation failed:', err.message);
    }
>>>>>>> 96777e4 (feat: add Google-style floating interactive media dock, animated badges, and Nemotron AI integration)
  }

  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 2000,
        system: finalSummarySystemPrompt,
        messages: [{ role: 'user', content: `Meeting transcript:\n\n${trimmed}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = parseFinalSummaryJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.error('[Final Summaries] Anthropic generation failed:', err.message);
    }
  }

  // Offline heuristic fallback - derive the three summaries directly from the transcript text.
  const sentences = (trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed]).map((s) => s.trim()).filter(Boolean);
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const speakers = Array.from(new Set(lines.map((l) => l.match(/^\[?\d{0,2}:?\d{0,2}\]?\s*([^:]{1,40}):/)?.[1]?.trim()).filter(Boolean)));

  const executive = `Executive Summary: ${sentences.slice(0, 3).join(' ') || trimmed.slice(0, 240)}`;
  const technical = `Technical Summary: The discussion covered ${sentences.length} distinct points across ${lines.length || 1} transcript entries. Key technical themes: ${sentences.slice(3, 6).join(' ') || 'general implementation and process discussion.'}`;
  const minutes = `Meeting Minutes\nAttendees: ${speakers.length > 0 ? speakers.join(', ') : 'Not explicitly identified'}\nTopics Covered:\n${sentences.slice(0, 5).map((s) => `- ${s}`).join('\n') || '- General discussion'}`;

  return { executive, technical, minutes };
}
