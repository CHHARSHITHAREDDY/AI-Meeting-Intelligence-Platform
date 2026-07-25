import { FinalMeetingSummaries, LiveMeetingInsights, LiveTranscriptEntry } from './liveMeeting';

export type LiveMeetingStatus = 'scheduled' | 'live' | 'ended';

export interface LiveMeetingRecord {
  id: string;
  title: string;
  hostName: string;
  joinLink: string;
  zoomLink: string;
  status: LiveMeetingStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  participants: string[];
  transcriptEntries: LiveTranscriptEntry[];
  transcriptText: string;
  insights: LiveMeetingInsights;
  memory: string[];
  aiActivity: Array<{ id: string; text: string; timestamp: string }>;
  finalSummaries?: FinalMeetingSummaries;
}

// Force a true cross-route singleton via globalThis. Next.js/Turbopack's dev
// bundler can compile sibling route files (e.g. live-meetings/[id]/route.ts
// and live-meetings/[id]/chat/route.ts) into separate module graphs, each
// re-evaluating this file and getting its OWN `new Map()` — so a meeting
// created/updated through one route silently didn't exist from the other
// route's point of view (getLiveMeeting() would auto-vivify a blank record,
// which read back as "no transcript captured yet" even though the real
// meeting had a full transcript). Stashing the Map on globalThis guarantees
// every route sees the exact same store within this process.
const globalForLiveMeetings = globalThis as unknown as { __liveMeetingStore?: Map<string, LiveMeetingRecord> };
const liveMeetingStore = globalForLiveMeetings.__liveMeetingStore ?? new Map<string, LiveMeetingRecord>();
globalForLiveMeetings.__liveMeetingStore = liveMeetingStore;

function makeMeetingId() {
  return `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeJoinLink(meetingId: string) {
  return `/dashboard/live?meetingId=${meetingId}`;
}

function makeZoomLink(meetingId: string) {
  return `/join/${meetingId}`;
}

export function createLiveMeeting(title: string, hostName: string): LiveMeetingRecord {
  const id = makeMeetingId();
  const now = new Date().toISOString();
  const meeting: LiveMeetingRecord = {
    id,
    title: title.trim() || 'Live AI Meeting',
    hostName: hostName.trim() || 'Host',
    joinLink: makeJoinLink(id),
    zoomLink: makeZoomLink(id),
    status: 'scheduled',
    createdAt: now,
    participants: [hostName.trim() || 'Host'],
    transcriptEntries: [],
    transcriptText: '',
    insights: {
      summary: 'Meeting created and waiting to start.',
      decisions: [],
      actionItems: [],
      risks: [],
    },
    memory: [],
    aiActivity: [{ id: `ai-${id}`, text: 'Meeting created and ready for live AI processing.', timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }],
  };

  liveMeetingStore.set(id, meeting);
  return meeting;
}

export function getLiveMeeting(meetingId: string): LiveMeetingRecord {
  let meeting = liveMeetingStore.get(meetingId);
  if (!meeting) {
    const now = new Date().toISOString();
    meeting = {
      id: meetingId,
      title: 'Live AI Meeting',
      hostName: 'Host',
      joinLink: makeJoinLink(meetingId),
      zoomLink: makeZoomLink(meetingId),
      status: 'live',
      createdAt: now,
      startedAt: now,
      participants: ['Host'],
      transcriptEntries: [],
      transcriptText: '',
      insights: {
        summary: 'Live meeting session active.',
        decisions: [],
        actionItems: [],
        risks: [],
      },
      memory: [],
      aiActivity: [{ id: `ai-${meetingId}`, text: 'Live meeting initialized and listening for speech.', timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }],
    };
    liveMeetingStore.set(meetingId, meeting);
  }
  return meeting;
}

export function getLiveMeetingPublicInfo(meetingId: string) {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return null;
  return {
    id: meeting.id,
    title: meeting.title,
    hostName: meeting.hostName,
    status: meeting.status,
    participantCount: meeting.participants.length,
    participants: meeting.participants,
    createdAt: meeting.createdAt,
  };
}

export function listLiveMeetings(): LiveMeetingRecord[] {
  return Array.from(liveMeetingStore.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateLiveMeetingStatus(meetingId: string, status: LiveMeetingStatus): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;

  meeting.status = status;
  if (status === 'live' && !meeting.startedAt) {
    meeting.startedAt = new Date().toISOString();
  }
  if (status === 'ended' && !meeting.endedAt) {
    meeting.endedAt = new Date().toISOString();
  }
  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}

export function addParticipant(meetingId: string, participantName: string): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;

  const normalized = participantName.trim();
  if (!normalized) return meeting;
  if (!meeting.participants.includes(normalized)) {
    meeting.participants = [...meeting.participants, normalized];
  }
  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}

export function appendTranscriptAndInsights(meetingId: string, entry: LiveTranscriptEntry, insights: LiveMeetingInsights): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;

  meeting.status = 'live';
  if (!meeting.startedAt) meeting.startedAt = new Date().toISOString();

  const updatedEntries = [...meeting.transcriptEntries, entry];
  meeting.transcriptEntries = updatedEntries;
  // Keep speaker + timestamp labels in the flattened transcript text (not
  // just the raw words) — this is what gets sent to the chat AI and the
  // end-of-meeting summarizer, and without speaker attribution neither can
  // answer "who said/owns X" questions or credit the right person in minutes.
  meeting.transcriptText = updatedEntries.map((item) => `[${item.timestamp}] ${item.speaker}: ${item.text}`).join('\n');
  meeting.insights = insights;

  if (meeting.memory.length === 0) {
    meeting.memory = insights.actionItems.length > 0 || insights.decisions.length > 0 || insights.risks.length > 0
      ? [
          insights.summary,
          ...insights.decisions.slice(0, 2).map((item) => `Decision: ${item.title}`),
          ...insights.actionItems.slice(0, 2).map((item) => `Action: ${item.title}`),
          ...insights.risks.slice(0, 2).map((item) => `Risk: ${item.title}`),
        ]
      : [insights.summary];
  }

  meeting.aiActivity = [
    {
      id: `ai-${Date.now()}`,
      text: `Processed transcript update: ${entry.text.slice(0, 120)}${entry.text.length > 120 ? '…' : ''}`,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    },
    ...meeting.aiActivity.slice(0, 4),
  ];

  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}

export function addMemoryNote(meetingId: string, note: string): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;
  const normalized = note.trim();
  if (!normalized) return meeting;
  meeting.memory = [normalized, ...meeting.memory].slice(0, 8);
  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}

export function addAiActivity(meetingId: string, text: string): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;
  meeting.aiActivity = [{ id: `activity-${Date.now()}`, text, timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }, ...meeting.aiActivity].slice(0, 8);
  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}

export function setFinalSummaries(meetingId: string, summaries: FinalMeetingSummaries): LiveMeetingRecord | undefined {
  const meeting = liveMeetingStore.get(meetingId);
  if (!meeting) return undefined;
  meeting.finalSummaries = summaries;
  liveMeetingStore.set(meetingId, meeting);
  return meeting;
}
