import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'meetings.json');

export interface Decision {
  id: string;
  decision: string;
  decider: string;
  context: string;
}

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
  status: 'pending' | 'completed';
}

export interface Risk {
  id: string;
  risk: string;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface MeetingAnalysis {
  summary: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  transcript: string;
  analysis?: MeetingAnalysis;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function getMeetings(): Promise<Meeting[]> {
  try {
    await ensureDir(DB_PATH);
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const meetings = await getMeetings();
  return meetings.find(m => m.id === id) || null;
}

export async function saveMeeting(meeting: Meeting): Promise<void> {
  await ensureDir(DB_PATH);
  const meetings = await getMeetings();
  const index = meetings.findIndex(m => m.id === meeting.id);
  if (index !== -1) {
    meetings[index] = meeting;
  } else {
    meetings.push(meeting);
  }
  
  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(meetings, null, 2), 'utf-8');
  await fs.rename(tempPath, DB_PATH);
}

export async function deleteMeeting(id: string): Promise<void> {
  await ensureDir(DB_PATH);
  const meetings = await getMeetings();
  const filtered = meetings.filter(m => m.id !== id);
  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(filtered, null, 2), 'utf-8');
  await fs.rename(tempPath, DB_PATH);
}
