import Anthropic from '@anthropic-ai/sdk';
import { Meeting, ProjectSummary, ProjectProgress, ProjectFlowEntry, getMeetingsByProject, updateProjectIntelligence } from './db';
import { runLlamaCloudExtraction } from './llamaCloud';

/**
 * Builds a compact, high-signal context block from every meeting in a
 * project (title, date, summary, decisions, action items, risks, notes).
 * Uses each meeting's already-extracted structured insights rather than raw
 * transcripts, so this scales to many meetings without blowing up prompt
 * size the way concatenating full transcripts would.
 */
function buildProjectContext(meetings: Meeting[]): string {
  const completed = meetings.filter((m) => m.status === 'completed');
  return completed
    .map((m, idx) => {
      const a = m.analysis;
      const lines = [
        `=== Meeting ${idx + 1}: "${m.title}" (${new Date(m.date).toLocaleDateString()}) ===`,
        `Summary: ${a?.summary || 'N/A'}`,
      ];
      if (a?.decisions?.length) lines.push(`Decisions: ${a.decisions.map((d) => `${d.decision} (${d.context || ''})`).join('; ')}`);
      if (a?.actionItems?.length) lines.push(`Action Items: ${a.actionItems.map((x) => `${x.task} [${x.status}] (Owner: ${x.assignee}, Due: ${x.dueDate})`).join('; ')}`);
      if (a?.risks?.length) lines.push(`Risks: ${a.risks.map((r) => `${r.risk} (Impact: ${r.impact}, Mitigation: ${r.mitigation})`).join('; ')}`);
      if (a?.notes?.length) lines.push(`Notes: ${a.notes.join('; ')}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

function parseJsonResponse(text: string): any | null {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();
  const startIdx = clean.indexOf('{');
  const endIdx = clean.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
  try {
    return JSON.parse(clean);
  } catch (_) {
    return null;
  }
}

async function runProjectExtraction(context: string, systemPrompt: string, schema: object): Promise<any | null> {
  const llamaResult = await runLlamaCloudExtraction(context, schema);
  if (llamaResult) return llamaResult;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey && anthropicApiKey !== 'YOUR_ANTHROPIC_API_KEY' && anthropicApiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return parseJsonResponse(text);
    } catch (err: any) {
      console.error('[Project Intelligence] Anthropic fallback failed:', err.message);
    }
  }

  return null;
}

const SUMMARY_SYSTEM_PROMPT = `You are a project intelligence analyst. You are given a series of meetings (in chronological order) belonging to a single project. Synthesize ONE coherent project-level summary — do NOT simply concatenate the individual meeting summaries. Respond with ONLY a valid JSON object matching:
{
  "objective": "The overall goal/objective of this project, inferred from across all meetings.",
  "currentFocus": "What the team is currently focused on, based on the most recent meeting(s).",
  "overallProgress": "A short qualitative sentence describing overall progress.",
  "completedWork": ["Completed piece of work 1", "..."],
  "workInProgress": ["Work currently in progress", "..."],
  "remainingWork": ["Work still remaining", "..."],
  "recentAchievements": ["A recent achievement", "..."],
  "nextPriorities": ["An upcoming priority", "..."]
}
Do not include any text before or after the JSON.`;

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    objective: { type: 'string' },
    currentFocus: { type: 'string' },
    overallProgress: { type: 'string' },
    completedWork: { type: 'array', items: { type: 'string' } },
    workInProgress: { type: 'array', items: { type: 'string' } },
    remainingWork: { type: 'array', items: { type: 'string' } },
    recentAchievements: { type: 'array', items: { type: 'string' } },
    nextPriorities: { type: 'array', items: { type: 'string' } },
  },
  required: ['objective', 'currentFocus', 'overallProgress', 'completedWork', 'workInProgress', 'remainingWork', 'recentAchievements', 'nextPriorities'],
};

export async function generateProjectSummary(meetings: Meeting[]): Promise<ProjectSummary> {
  const context = buildProjectContext(meetings);
  if (!context.trim()) {
    return {
      objective: 'No analyzed meetings yet — upload a recording to this project to generate a summary.',
      currentFocus: 'N/A',
      overallProgress: 'No meetings analyzed yet.',
      completedWork: [],
      workInProgress: [],
      remainingWork: [],
      recentAchievements: [],
      nextPriorities: [],
    };
  }

  const raw = await runProjectExtraction(context, SUMMARY_SYSTEM_PROMPT, SUMMARY_SCHEMA);
  if (raw && raw.objective) {
    return {
      objective: raw.objective || '',
      currentFocus: raw.currentFocus || '',
      overallProgress: raw.overallProgress || '',
      completedWork: Array.isArray(raw.completedWork) ? raw.completedWork : [],
      workInProgress: Array.isArray(raw.workInProgress) ? raw.workInProgress : [],
      remainingWork: Array.isArray(raw.remainingWork) ? raw.remainingWork : [],
      recentAchievements: Array.isArray(raw.recentAchievements) ? raw.recentAchievements : [],
      nextPriorities: Array.isArray(raw.nextPriorities) ? raw.nextPriorities : [],
    };
  }

  return heuristicProjectSummary(meetings);
}

function heuristicProjectSummary(meetings: Meeting[]): ProjectSummary {
  const completed = meetings.filter((m) => m.status === 'completed');
  const allActionItems = completed.flatMap((m) => m.analysis?.actionItems || []);
  const allRisks = completed.flatMap((m) => m.analysis?.risks || []);
  const lastMeeting = completed[completed.length - 1];
  const firstMeeting = completed[0];

  const completedTasks = allActionItems.filter((a) => a.status === 'completed').map((a) => a.task);
  const pendingTasks = allActionItems.filter((a) => a.status !== 'completed').map((a) => a.task);

  return {
    objective: firstMeeting?.analysis?.summary || 'Project objective not yet established.',
    currentFocus: lastMeeting?.analysis?.summary || 'No recent meeting activity.',
    overallProgress: `${completedTasks.length} of ${allActionItems.length || 0} tracked tasks completed across ${completed.length} meeting(s).`,
    completedWork: completedTasks.slice(0, 8),
    workInProgress: pendingTasks.slice(0, 8),
    remainingWork: allRisks.map((r) => r.risk).slice(0, 8),
    recentAchievements: (lastMeeting?.analysis?.decisions || []).map((d) => d.decision).slice(0, 5),
    nextPriorities: pendingTasks.slice(0, 5),
  };
}

const PROGRESS_SYSTEM_PROMPT = `You are a project intelligence analyst. You are given a series of meetings belonging to a single project. Estimate overall project progress. Respond with ONLY a valid JSON object matching:
{
  "completionPercent": 0-100,
  "completedFeatures": ["Completed feature/task", "..."],
  "inProgressFeatures": ["Feature/task currently in progress", "..."],
  "pendingFeatures": ["Feature/task not yet started, or a blocker/risk preventing progress", "..."],
  "currentFocus": "Current sprint/focus area.",
  "recentlyCompleted": ["Something completed recently", "..."]
}
Do not include any text before or after the JSON.`;

const PROGRESS_SCHEMA = {
  type: 'object',
  properties: {
    completionPercent: { type: 'number' },
    completedFeatures: { type: 'array', items: { type: 'string' } },
    inProgressFeatures: { type: 'array', items: { type: 'string' } },
    pendingFeatures: { type: 'array', items: { type: 'string' } },
    currentFocus: { type: 'string' },
    recentlyCompleted: { type: 'array', items: { type: 'string' } },
  },
  required: ['completionPercent', 'completedFeatures', 'inProgressFeatures', 'pendingFeatures', 'currentFocus', 'recentlyCompleted'],
};

export async function generateProjectProgress(meetings: Meeting[]): Promise<ProjectProgress> {
  const context = buildProjectContext(meetings);
  if (!context.trim()) {
    return {
      completionPercent: 0,
      completedFeatures: [],
      inProgressFeatures: [],
      pendingFeatures: [],
      currentFocus: 'No meetings analyzed yet.',
      recentlyCompleted: [],
    };
  }

  const raw = await runProjectExtraction(context, PROGRESS_SYSTEM_PROMPT, PROGRESS_SCHEMA);
  if (raw && typeof raw.completionPercent === 'number') {
    return {
      completionPercent: Math.max(0, Math.min(100, Math.round(raw.completionPercent))),
      completedFeatures: Array.isArray(raw.completedFeatures) ? raw.completedFeatures : [],
      inProgressFeatures: Array.isArray(raw.inProgressFeatures) ? raw.inProgressFeatures : [],
      pendingFeatures: Array.isArray(raw.pendingFeatures) ? raw.pendingFeatures : [],
      currentFocus: raw.currentFocus || '',
      recentlyCompleted: Array.isArray(raw.recentlyCompleted) ? raw.recentlyCompleted : [],
    };
  }

  return heuristicProjectProgress(meetings);
}

function heuristicProjectProgress(meetings: Meeting[]): ProjectProgress {
  const completed = meetings.filter((m) => m.status === 'completed');
  const allActionItems = completed.flatMap((m) => m.analysis?.actionItems || []);
  const allRisks = completed.flatMap((m) => m.analysis?.risks || []);
  const lastMeeting = completed[completed.length - 1];

  const completedTasks = allActionItems.filter((a) => a.status === 'completed').map((a) => a.task);
  const pendingTasks = allActionItems.filter((a) => a.status !== 'completed').map((a) => a.task);
  const completionPercent = allActionItems.length > 0
    ? Math.round((completedTasks.length / allActionItems.length) * 100)
    : 0;

  const lastMeetingCompletedTasks = (lastMeeting?.analysis?.actionItems || [])
    .filter((a) => a.status === 'completed')
    .map((a) => a.task);

  return {
    completionPercent,
    completedFeatures: completedTasks.slice(0, 10),
    inProgressFeatures: pendingTasks.slice(0, 10),
    pendingFeatures: allRisks.map((r) => r.risk).slice(0, 10),
    currentFocus: lastMeeting?.analysis?.summary || 'No recent activity.',
    recentlyCompleted: lastMeetingCompletedTasks.slice(0, 5),
  };
}

const FLOW_SYSTEM_PROMPT = `You are a project intelligence analyst. You are given a series of meetings belonging to a single project, in chronological order. Produce a chronological timeline of how the project evolved — key milestones, decisions, and completed work, one entry per significant event. Respond with ONLY a valid JSON object matching:
{
  "timeline": [
    { "date": "A date or relative marker for this event, e.g. the meeting date.", "title": "Short milestone title, e.g. 'Tech stack selected'.", "description": "One sentence of detail." }
  ]
}
Produce one entry per meeting at minimum, plus additional entries for major decisions within a meeting if warranted. Do not include any text before or after the JSON.`;

const FLOW_SCHEMA = {
  type: 'object',
  properties: {
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['title', 'description'],
      },
    },
  },
  required: ['timeline'],
};

export async function generateProjectFlow(meetings: Meeting[]): Promise<ProjectFlowEntry[]> {
  const completed = meetings.filter((m) => m.status === 'completed');
  if (completed.length === 0) return [];

  const context = buildProjectContext(meetings);
  const raw = await runProjectExtraction(context, FLOW_SYSTEM_PROMPT, FLOW_SCHEMA);
  if (raw && Array.isArray(raw.timeline) && raw.timeline.length > 0) {
    return raw.timeline.map((entry: any) => ({
      date: entry.date || '',
      title: entry.title || 'Milestone',
      description: entry.description || '',
    }));
  }

  return heuristicProjectFlow(completed);
}

function heuristicProjectFlow(completed: Meeting[]): ProjectFlowEntry[] {
  return completed.map((m) => ({
    date: new Date(m.date).toLocaleDateString(),
    title: m.title,
    description: m.analysis?.decisions?.[0]?.decision || m.analysis?.summary || 'Meeting recorded and analyzed.',
  }));
}

const QA_SYSTEM_PROMPT_BASE = `You are the AI assistant for a project workspace. Answer the user's question grounded EXCLUSIVELY in the meeting context provided below, which spans every meeting in this project (in chronological order). Search across ALL meetings before answering — the answer may depend on information from an earlier meeting even if a later one is more recent. Cite which meeting (by title) information comes from when relevant. If the answer cannot be found in the provided context, say so plainly instead of guessing. Respond with ONLY a valid JSON object matching: { "answer": "your answer" }`;

const QA_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

export async function answerProjectQuestion(meetings: Meeting[], question: string): Promise<string> {
  const context = buildProjectContext(meetings);
  if (!context.trim()) {
    return "This project doesn't have any analyzed meetings yet — upload a recording first and I'll be able to answer questions grounded in it.";
  }

  const fullPrompt = `${QA_SYSTEM_PROMPT_BASE}\n\nProject meeting context:\n${context}\n\nQuestion: ${question}`;
  const raw = await runProjectExtraction(fullPrompt, QA_SYSTEM_PROMPT_BASE, QA_SCHEMA);
  if (raw && typeof raw.answer === 'string' && raw.answer.trim()) {
    return raw.answer;
  }

  return heuristicProjectAnswer(meetings, question);
}

function heuristicProjectAnswer(meetings: Meeting[], question: string): string {
  const completed = meetings.filter((m) => m.status === 'completed');
  const q = question.toLowerCase();

  if (q.includes('summar')) {
    const last = completed[completed.length - 1];
    return last?.analysis?.summary
      ? `Most recent meeting ("${last.title}"): ${last.analysis.summary}`
      : 'No meeting summaries available yet.';
  }

  if (q.includes('decision')) {
    const decisions = completed.flatMap((m) => (m.analysis?.decisions || []).map((d) => `• ${d.decision} (from "${m.title}")`));
    return decisions.length ? `Decisions made across this project:\n${decisions.join('\n')}` : 'No decisions have been recorded yet.';
  }

  if (q.includes('pending') || q.includes('task') || q.includes('todo')) {
    const pending = completed.flatMap((m) => (m.analysis?.actionItems || []).filter((a) => a.status !== 'completed').map((a) => `• ${a.task} — Owner: ${a.assignee} (from "${m.title}")`));
    return pending.length ? `Pending tasks:\n${pending.join('\n')}` : 'No pending tasks found.';
  }

  if (q.includes('blocker') || q.includes('risk') || q.includes('block')) {
    const risks = completed.flatMap((m) => (m.analysis?.risks || []).map((r) => `• ${r.risk} (Impact: ${r.impact}, from "${m.title}")`));
    return risks.length ? `Risks/blockers identified:\n${risks.join('\n')}` : 'No risks or blockers have been flagged.';
  }

  if (q.includes('changed since') || q.includes('last meeting')) {
    const last = completed[completed.length - 1];
    const prev = completed[completed.length - 2];
    if (!last) return 'No meetings recorded yet.';
    if (!prev) return `Only one meeting recorded so far ("${last.title}"): ${last.analysis?.summary || ''}`;
    return `Since "${prev.title}", the most recent meeting ("${last.title}") covered: ${last.analysis?.summary || 'no summary available'}.`;
  }

  // Generic keyword search across all meetings' structured insights.
  const stopWords = new Set(['what', 'when', 'where', 'who', 'how', 'why', 'that', 'this', 'there', 'their', 'them', 'with', 'from', 'about', 'does', 'have', 'been', 'were', 'project']);
  const keywords = q.replace(/[?.,!:-]/g, '').split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length > 0) {
    const searchable: { text: string; meeting: string }[] = [];
    completed.forEach((m) => {
      const a = m.analysis;
      if (a?.summary) searchable.push({ text: a.summary, meeting: m.title });
      (a?.decisions || []).forEach((d) => searchable.push({ text: `${d.decision} ${d.context}`, meeting: m.title }));
      (a?.actionItems || []).forEach((x) => searchable.push({ text: x.task, meeting: m.title }));
      (a?.risks || []).forEach((r) => searchable.push({ text: `${r.risk} ${r.mitigation}`, meeting: m.title }));
      (a?.notes || []).forEach((n) => searchable.push({ text: n, meeting: m.title }));
    });

    const scored = searchable
      .map((item) => {
        const lower = item.text.toLowerCase();
        const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
        return { ...item, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scored.length > 0) {
      return `Based on the project's meeting history:\n${scored.map((s) => `• ${s.text} (from "${s.meeting}")`).join('\n')}`;
    }
  }

  return "I couldn't find anything specific about that across this project's meetings. Try asking about decisions, pending tasks, risks, or a summary.";
}

/**
 * Regenerates the AI Project Summary, Progress, and Flow together and caches
 * them on the project row. Called automatically after every meeting upload
 * (so the project view updates without the user needing to manually
 * refresh), and available on-demand via a "Refresh" action too.
 */
export async function regenerateProjectIntelligence(projectId: string, userId: string): Promise<void> {
  const meetings = await getMeetingsByProject(projectId, userId);
  const [aiSummary, progress, flow] = await Promise.all([
    generateProjectSummary(meetings),
    generateProjectProgress(meetings),
    generateProjectFlow(meetings),
  ]);
  await updateProjectIntelligence(projectId, { aiSummary, progress, flow });
}
