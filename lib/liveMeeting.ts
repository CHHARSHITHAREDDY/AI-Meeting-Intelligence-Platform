export interface LiveTranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface LiveInsightItem {
  id: string;
  title: string;
  detail: string;
  assignee?: string;
  dueDate?: string;
}

export interface LiveMeetingInsights {
  summary: string;
  decisions: LiveInsightItem[];
  actionItems: LiveInsightItem[];
  risks: LiveInsightItem[];
}

const STOP_WORDS = new Set(['i', 'we', 'you', 'they', 'team', 'everyone', 'all', 'let', 'let us', "let's"]);

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isLikelyName(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (STOP_WORDS.has(normalized.toLowerCase())) return false;
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(normalized);
}

function extractAssignment(text: string): { assignee: string; task: string } | null {
  const trimmed = cleanText(text);
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:must|should|will|needs to|need to|can|please)\s+(?:do|handle|own|take care of|prepare|send|review|complete|update|fix|draft|share|follow up on|work on)\s+(.+)/i,
    /(?:assign|assigned|task to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:for|to)?\s*(.+)/i,
    /(?:for|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*(?:please|can you|could you)\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const assignee = match[1]?.trim();
    const task = (match[2] || trimmed).trim();
    if (assignee && isLikelyName(assignee) && task) {
      return { assignee, task: task.replace(/^[^a-zA-Z0-9]+/, '') };
    }
  }

  return null;
}

function extractDecision(text: string): string | null {
  const trimmed = cleanText(text);
  const patterns = [
    /(?:we|team|everyone|we all|we've|we have)\s+(?:agreed|decided|agree|decide|choose|chose|will|are going to|will go with|will use|will proceed with|opt for|commit to)\s+(.+)/i,
    /(?:final decision|decision is|our decision|it is decided|the plan is)\s*(.+)/i,
    /(?:let's|let us)\s+(?:go with|move forward with|proceed with|use|adopt|implement|keep)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
}

function extractRisk(text: string): string | null {
  const trimmed = cleanText(text);
  const patterns = [
    /(?:risk|problem|issue|concern|delay|danger|worry|challenge|blocked|bottleneck|lag|dependency)\s+(.+)/i,
    /(?:might|may)\s+(?:impact|delay|block|cause)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
}

export function buildLiveMeetingInsights(entries: LiveTranscriptEntry[]): LiveMeetingInsights {
  const transcriptText = entries.map((entry) => entry.text).join(' ');

  const decisions: LiveInsightItem[] = [];
  const actionItems: LiveInsightItem[] = [];
  const risks: LiveInsightItem[] = [];

  entries.forEach((entry, index) => {
    const decision = extractDecision(entry.text);
    if (decision && decisions.length < 5) {
      decisions.push({
        id: `decision-${index + 1}`,
        title: decision,
        detail: `Captured from ${entry.speaker}`,
      });
    }

    const assignment = extractAssignment(entry.text);
    if (assignment && actionItems.length < 5) {
      actionItems.push({
        id: `action-${index + 1}`,
        title: assignment.task,
        detail: `Assigned to ${assignment.assignee}`,
        assignee: assignment.assignee,
        dueDate: 'TBD',
      });
    }

    const risk = extractRisk(entry.text);
    if (risk && risks.length < 5) {
      risks.push({
        id: `risk-${index + 1}`,
        title: risk,
        detail: `Flagged during the live discussion`,
      });
    }
  });

  const summary = entries.length > 0
    ? `Live discussion is tracking ${entries.length} spoken moments with ${actionItems.length} action items and ${decisions.length} decisions.`
    : 'Start the meeting transcript to begin live insight extraction.';

  return {
    summary,
    decisions,
    actionItems,
    risks,
  };
}
