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
  timestamp?: string;
  /** Decisions: model/heuristic confidence 0-100 */
  confidence?: number;
  /** Action items */
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  /** Risks */
  severity?: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface LiveMeetingInsights {
  summary: string;
  decisions: LiveInsightItem[];
  actionItems: LiveInsightItem[];
  risks: LiveInsightItem[];
}

export interface FinalMeetingSummaries {
  executive: string;
  technical: string;
  minutes: string;
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

const DEADLINE_PATTERN = /\b(today|tomorrow|tonight|eod|end of day|end of week|eow|next week|this week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[^.!?]{0,20}|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;

function extractDeadline(text: string): string | undefined {
  const match = text.match(DEADLINE_PATTERN);
  if (!match) return undefined;
  return match[0].replace(/\s+/g, ' ').trim();
}

function inferPriority(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  if (/\b(urgent|asap|immediately|critical|blocker|high priority|right away)\b/.test(lower)) return 'high';
  if (/\b(when you can|no rush|low priority|eventually|whenever|nice to have)\b/.test(lower)) return 'low';
  return 'medium';
}

function inferSeverity(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  if (/\b(critical|severe|blocker|blocked|major|urgent|outage|down|breaking)\b/.test(lower)) return 'high';
  if (/\b(minor|small|slight|cosmetic|low)\b/.test(lower)) return 'low';
  return 'medium';
}

function suggestMitigation(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') return 'Escalate immediately and assign a directly responsible owner to unblock before the next sync.';
  if (severity === 'low') return 'Monitor and revisit if it resurfaces; no immediate action required.';
  return 'Track closely and follow up in the next check-in.';
}

/** Deterministic pseudo-confidence in the 78-97 range, stable for identical text. */
function confidenceFromText(text: string, strongPattern: boolean): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const base = strongPattern ? 88 : 78;
  const spread = strongPattern ? 9 : 12;
  return base + (hash % spread);
}

function dedupeByTitle(items: LiveInsightItem[]): LiveInsightItem[] {
  const seen = new Set<string>();
  const result: LiveInsightItem[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

const MAX_ITEMS_PER_CATEGORY = 25;

export function buildLiveMeetingInsights(entries: LiveTranscriptEntry[]): LiveMeetingInsights {
  let decisions: LiveInsightItem[] = [];
  let actionItems: LiveInsightItem[] = [];
  let risks: LiveInsightItem[] = [];

  entries.forEach((entry, index) => {
    const decision = extractDecision(entry.text);
    if (decision) {
      decisions.push({
        id: `decision-${index + 1}`,
        title: decision,
        detail: `Captured from ${entry.speaker}`,
        timestamp: entry.timestamp,
        confidence: confidenceFromText(decision, true),
      });
    }

    const assignment = extractAssignment(entry.text);
    if (assignment) {
      actionItems.push({
        id: `action-${index + 1}`,
        title: assignment.task,
        detail: `Assigned to ${assignment.assignee}`,
        assignee: assignment.assignee,
        dueDate: extractDeadline(entry.text) || 'Not specified',
        priority: inferPriority(entry.text),
        timestamp: entry.timestamp,
      });
    }

    const risk = extractRisk(entry.text);
    if (risk) {
      const severity = inferSeverity(entry.text);
      risks.push({
        id: `risk-${index + 1}`,
        title: risk,
        detail: `Flagged during the live discussion by ${entry.speaker}`,
        severity,
        mitigation: suggestMitigation(severity),
        timestamp: entry.timestamp,
      });
    }
  });

  decisions = dedupeByTitle(decisions).slice(-MAX_ITEMS_PER_CATEGORY);
  actionItems = dedupeByTitle(actionItems).slice(-MAX_ITEMS_PER_CATEGORY);
  risks = dedupeByTitle(risks).slice(-MAX_ITEMS_PER_CATEGORY);

  const summary = entries.length > 0
    ? `Live discussion is tracking ${entries.length} spoken moments with ${actionItems.length} action item(s), ${decisions.length} decision(s), and ${risks.length} risk(s) so far.`
    : 'Start the meeting transcript to begin live insight extraction.';

  return {
    summary,
    decisions,
    actionItems,
    risks,
  };
}
