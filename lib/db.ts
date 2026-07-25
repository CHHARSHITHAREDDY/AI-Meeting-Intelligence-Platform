import { Pool } from 'pg';
import { ContentType } from './classify';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let isDbInitialized = false;

export async function initDb() {
  if (isDbInitialized) return;
  
  const client = await pool.connect();
  try {
    console.log('[Neon DB] Initializing tables...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        ai_summary JSONB,
        progress JSONB,
        flow JSONB,
        intelligence_updated_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // Create meetings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(255) NOT NULL,
        duration VARCHAR(255) NOT NULL,
        transcript TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        analysis JSONB,
        error TEXT,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL
      );
    `);

    // Existing databases created before the Projects feature won't have this
    // column yet — add it if missing rather than requiring a fresh DB.
    await client.query(`
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL;
    `);

    console.log('[Neon DB] Tables verified successfully.');
    isDbInitialized = true;
  } catch (error) {
    console.error('[Neon DB] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

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

export interface SpeakerMetric {
  name: string;
  talkTimePercent: number;
  wordCount: number;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface MindmapNode {
  topic: string;
  children?: MindmapNode[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface ApiMention {
  name: string;
  description: string;
}

export interface LibraryMention {
  name: string;
  purpose: string;
}

export interface CommandMention {
  command: string;
  description: string;
}

export interface TimelineEntry {
  timestamp: string;
  topic: string;
}

export interface ResourceMention {
  name: string;
  type?: string;
  reference?: string;
}

export interface MeetingAnalysis {
  summary: string;
  keyDiscussionPoints?: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Risk[];
  nextSteps?: string[];
  notes?: string[];
  chunks?: any[];
  suggestedPrompts?: string[];
  unresolvedQuestions?: string[];
  efficiencyScore?: number;
  speakerAnalytics?: SpeakerMetric[];

  // Content-type classification (see lib/classify.ts)
  contentType?: ContentType;
  contentTypeConfidence?: number;

  // Lecture-specific fields
  flashcards?: Flashcard[];
  mindmap?: MindmapNode;
  quiz?: QuizQuestion[];

  // Coding-specific fields
  codeGuide?: string;
  apis?: ApiMention[];
  libraries?: LibraryMention[];
  commands?: CommandMention[];

  // Podcast-specific fields
  keyInsights?: string[];
  timeline?: TimelineEntry[];
  resources?: ResourceMention[];
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  transcript: string;
  analysis?: MeetingAnalysis;
  status: 'processing' | 'completed' | 'failed' | 'live';
  error?: string;
  projectId?: string;
}

export interface ProjectSummary {
  objective: string;
  currentFocus: string;
  overallProgress: string;
  completedWork: string[];
  workInProgress: string[];
  remainingWork: string[];
  recentAchievements: string[];
  nextPriorities: string[];
}

export interface ProjectProgress {
  completionPercent: number;
  completedFeatures: string[];
  inProgressFeatures: string[];
  pendingFeatures: string[];
  currentFocus: string;
  recentlyCompleted: string[];
}

export interface ProjectFlowEntry {
  date: string;
  title: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  aiSummary?: ProjectSummary;
  progress?: ProjectProgress;
  flow?: ProjectFlowEntry[];
  intelligenceUpdatedAt?: string;
}

// User-related DB operations
export async function createUser(id: string, email: string, passwordHash: string, name: string): Promise<void> {
  await initDb();
  await pool.query(
    'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
    [id, email, passwordHash, name]
  );
}

export async function getUserByEmail(email: string): Promise<any | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function getUserById(id: string): Promise<any | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

function rowToMeeting(row: any): Meeting {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    duration: row.duration,
    transcript: row.transcript,
    status: row.status,
    analysis: row.analysis || undefined,
    error: row.error || undefined,
    projectId: row.project_id || undefined
  };
}

// Meeting-related DB operations (Isolated by User)
export async function getMeetings(userId: string): Promise<Meeting[]> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM meetings WHERE user_id = $1 ORDER BY date DESC', [userId]);
  return rows.map(rowToMeeting);
}

export async function getMeetingsByProject(projectId: string, userId: string): Promise<Meeting[]> {
  await initDb();
  const { rows } = await pool.query(
    'SELECT * FROM meetings WHERE project_id = $1 AND user_id = $2 ORDER BY date ASC',
    [projectId, userId]
  );
  return rows.map(rowToMeeting);
}

export async function getMeetingById(id: string, userId: string): Promise<Meeting | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1 AND user_id = $2', [id, userId]);
  if (rows.length === 0) return null;
  return rowToMeeting(rows[0]);
}

export async function saveMeeting(meeting: Meeting, userId: string): Promise<void> {
  await initDb();
  const { rows } = await pool.query('SELECT id FROM meetings WHERE id = $1 AND user_id = $2', [meeting.id, userId]);
  if (rows.length > 0) {
    await pool.query(
      'UPDATE meetings SET title = $1, date = $2, duration = $3, transcript = $4, status = $5, analysis = $6, error = $7, project_id = $8 WHERE id = $9 AND user_id = $10',
      [
        meeting.title,
        meeting.date,
        meeting.duration,
        meeting.transcript,
        meeting.status,
        meeting.analysis ? JSON.stringify(meeting.analysis) : null,
        meeting.error || null,
        meeting.projectId || null,
        meeting.id,
        userId
      ]
    );
  } else {
    await pool.query(
      'INSERT INTO meetings (id, title, date, duration, transcript, status, analysis, error, user_id, project_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        meeting.id,
        meeting.title,
        meeting.date,
        meeting.duration,
        meeting.transcript,
        meeting.status,
        meeting.analysis ? JSON.stringify(meeting.analysis) : null,
        meeting.error || null,
        userId,
        meeting.projectId || null
      ]
    );
  }
}

export async function deleteMeeting(id: string, userId: string): Promise<void> {
  await initDb();
  await pool.query('DELETE FROM meetings WHERE id = $1 AND user_id = $2', [id, userId]);
}

// Project-related DB operations (Isolated by User)
function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    aiSummary: row.ai_summary || undefined,
    progress: row.progress || undefined,
    flow: row.flow || undefined,
    intelligenceUpdatedAt: row.intelligence_updated_at || undefined
  };
}

export async function createProject(id: string, name: string, description: string, userId: string): Promise<Project> {
  await initDb();
  const { rows } = await pool.query(
    'INSERT INTO projects (id, name, description, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, name, description, userId]
  );
  return rowToProject(rows[0]);
}

export async function getProjects(userId: string): Promise<Project[]> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return rows.map(rowToProject);
}

export async function getProjectById(id: string, userId: string): Promise<Project | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
  if (rows.length === 0) return null;
  return rowToProject(rows[0]);
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await initDb();
  await pool.query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function updateProjectIntelligence(
  id: string,
  intelligence: { aiSummary?: ProjectSummary; progress?: ProjectProgress; flow?: ProjectFlowEntry[] }
): Promise<void> {
  await initDb();
  await pool.query(
    'UPDATE projects SET ai_summary = $1, progress = $2, flow = $3, intelligence_updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [
      intelligence.aiSummary ? JSON.stringify(intelligence.aiSummary) : null,
      intelligence.progress ? JSON.stringify(intelligence.progress) : null,
      intelligence.flow ? JSON.stringify(intelligence.flow) : null,
      id
    ]
  );
}
