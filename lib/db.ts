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

    // Calendar fields — additive, nullable, for meetings that are scheduled
    // ahead of time (before any recording/transcript exists).
    await client.query(`
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants JSONB;
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS agenda TEXT;
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS priority VARCHAR(20);
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS language VARCHAR(20);
      ALTER TABLE meetings ADD COLUMN IF NOT EXISTS detected_language VARCHAR(50);
    `);

    // Tasks table — independent, cross-meeting execution record populated
    // from AI extraction and/or manual creation. See lib/rag.ts's
    // matchActionItemToChunk for how traceability fields get filled in.
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        meeting_id VARCHAR(255) REFERENCES meetings(id) ON DELETE CASCADE,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        assignee VARCHAR(255) NOT NULL DEFAULT 'Unassigned',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        due_date VARCHAR(255),
        created_from VARCHAR(20) NOT NULL DEFAULT 'manual',
        source_timestamp VARCHAR(20),
        source_speaker VARCHAR(255),
        source_sentence TEXT,
        transcript_chunk_index INTEGER,
        completed_at TIMESTAMP WITH TIME ZONE,
        history JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
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
  status: 'processing' | 'completed' | 'failed' | 'live' | 'scheduled' | 'cancelled';
  error?: string;
  projectId?: string;

  // Calendar fields — present once a meeting is scheduled ahead of time or
  // has been enriched with a real occurrence time/attendee list.
  scheduledAt?: string;
  durationMinutes?: number;
  participants?: string[];
  agenda?: string;
  priority?: 'low' | 'medium' | 'high';
  language?: 'en' | 'hi' | 'te' | 'auto';
  detectedLanguage?: string;
}

export interface TaskHistoryEntry {
  status: string;
  changedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  meetingId?: string;
  projectId?: string;
  title: string;
  description?: string;
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  dueDate?: string;
  createdFrom: 'ai_extraction' | 'manual';
  sourceTimestamp?: string;
  sourceSpeaker?: string;
  sourceSentence?: string;
  transcriptChunkIndex?: number;
  completedAt?: string;
  history: TaskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
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
    projectId: row.project_id || undefined,
    scheduledAt: row.scheduled_at || undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    participants: row.participants || undefined,
    agenda: row.agenda || undefined,
    priority: row.priority || undefined,
    language: row.language || undefined,
    detectedLanguage: row.detected_language || undefined
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

// Calendar month/week/day views filter by scheduled_at when present,
// falling back to the upload/occurrence date otherwise, so both
// pre-scheduled and already-recorded meetings show up on the right day.
export async function getMeetingsByDateRange(userId: string, start: string, end: string): Promise<Meeting[]> {
  await initDb();
  const { rows } = await pool.query(
    `SELECT * FROM meetings
     WHERE user_id = $1
       AND COALESCE(scheduled_at, date::timestamptz) BETWEEN $2 AND $3
     ORDER BY COALESCE(scheduled_at, date::timestamptz) ASC`,
    [userId, start, end]
  );
  return rows.map(rowToMeeting);
}

export async function saveMeeting(meeting: Meeting, userId: string): Promise<void> {
  await initDb();
  const { rows } = await pool.query('SELECT id FROM meetings WHERE id = $1 AND user_id = $2', [meeting.id, userId]);
  if (rows.length > 0) {
    await pool.query(
      `UPDATE meetings SET title = $1, date = $2, duration = $3, transcript = $4, status = $5, analysis = $6,
         error = $7, project_id = $8, scheduled_at = $9, duration_minutes = $10, participants = $11,
         agenda = $12, priority = $13, language = $14, detected_language = $15
       WHERE id = $16 AND user_id = $17`,
      [
        meeting.title,
        meeting.date,
        meeting.duration,
        meeting.transcript,
        meeting.status,
        meeting.analysis ? JSON.stringify(meeting.analysis) : null,
        meeting.error || null,
        meeting.projectId || null,
        meeting.scheduledAt || null,
        meeting.durationMinutes ?? null,
        meeting.participants ? JSON.stringify(meeting.participants) : null,
        meeting.agenda || null,
        meeting.priority || null,
        meeting.language || null,
        meeting.detectedLanguage || null,
        meeting.id,
        userId
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO meetings
         (id, title, date, duration, transcript, status, analysis, error, user_id, project_id,
          scheduled_at, duration_minutes, participants, agenda, priority, language, detected_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
        meeting.projectId || null,
        meeting.scheduledAt || null,
        meeting.durationMinutes ?? null,
        meeting.participants ? JSON.stringify(meeting.participants) : null,
        meeting.agenda || null,
        meeting.priority || null,
        meeting.language || null,
        meeting.detectedLanguage || null
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

// Task-related DB operations (Isolated by User) — the independent,
// cross-meeting execution record. See lib/rag.ts's matchActionItemToChunk
// for how the source_* traceability columns get populated.
function rowToTask(row: any): Task {
  return {
    id: row.id,
    userId: row.user_id,
    meetingId: row.meeting_id || undefined,
    projectId: row.project_id || undefined,
    title: row.title,
    description: row.description || undefined,
    assignee: row.assignee,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date || undefined,
    createdFrom: row.created_from,
    sourceTimestamp: row.source_timestamp || undefined,
    sourceSpeaker: row.source_speaker || undefined,
    sourceSentence: row.source_sentence || undefined,
    transcriptChunkIndex: row.transcript_chunk_index ?? undefined,
    completedAt: row.completed_at || undefined,
    history: row.history || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface CreateTaskInput {
  id: string;
  userId: string;
  meetingId?: string;
  projectId?: string;
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdFrom: 'ai_extraction' | 'manual';
  sourceTimestamp?: string;
  sourceSpeaker?: string;
  sourceSentence?: string;
  transcriptChunkIndex?: number;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  await initDb();
  const { rows } = await pool.query(
    `INSERT INTO tasks
       (id, user_id, meeting_id, project_id, title, description, assignee, priority, due_date,
        created_from, source_timestamp, source_speaker, source_sentence, transcript_chunk_index,
        history)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [
      input.id,
      input.userId,
      input.meetingId || null,
      input.projectId || null,
      input.title,
      input.description || null,
      input.assignee || 'Unassigned',
      input.priority || 'medium',
      input.dueDate || null,
      input.createdFrom,
      input.sourceTimestamp || null,
      input.sourceSpeaker || null,
      input.sourceSentence || null,
      input.transcriptChunkIndex ?? null,
      JSON.stringify([{ status: 'pending', changedAt: new Date().toISOString() }])
    ]
  );
  if (rows.length > 0) return rowToTask(rows[0]);
  // Re-processing the same meeting (e.g. a retried upload) re-derives the
  // same task id — treat that as "already exists" rather than erroring.
  const existing = await getTaskById(input.id, input.userId);
  return existing as Task;
}

export interface TaskFilters {
  status?: 'pending' | 'completed';
  projectId?: string;
  meetingId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

export async function getTasks(userId: string, filters: TaskFilters = {}): Promise<Task[]> {
  await initDb();
  const conditions: string[] = ['user_id = $1'];
  const values: any[] = [userId];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  if (filters.projectId) {
    values.push(filters.projectId);
    conditions.push(`project_id = $${values.length}`);
  }
  if (filters.meetingId) {
    values.push(filters.meetingId);
    conditions.push(`meeting_id = $${values.length}`);
  }
  if (filters.dueBefore) {
    values.push(filters.dueBefore);
    conditions.push(`due_date IS NOT NULL AND due_date <= $${values.length}`);
  }
  if (filters.dueAfter) {
    values.push(filters.dueAfter);
    conditions.push(`due_date IS NOT NULL AND due_date >= $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC NULLS LAST, created_at DESC`,
    values
  );
  return rows.map(rowToTask);
}

export async function getTaskById(id: string, userId: string): Promise<Task | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
  if (rows.length === 0) return null;
  return rowToTask(rows[0]);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'completed';
  dueDate?: string;
}

export async function updateTask(id: string, userId: string, patch: UpdateTaskInput): Promise<Task | null> {
  await initDb();
  const existing = await getTaskById(id, userId);
  if (!existing) return null;

  // Only apply keys the caller actually provided — spreading `patch`
  // wholesale would wipe out fields whose value happens to be undefined
  // (e.g. a PATCH body that only sets `status` but still carries an
  // `assignee: undefined` key from the route's destructuring).
  const next: Task = { ...existing };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.assignee !== undefined) next.assignee = patch.assignee;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate;

  const statusChanged = patch.status && patch.status !== existing.status;
  const history = statusChanged
    ? [...existing.history, { status: patch.status!, changedAt: new Date().toISOString() }]
    : existing.history;
  const completedAt = patch.status === 'completed'
    ? (existing.completedAt || new Date().toISOString())
    : (patch.status === 'pending' ? undefined : existing.completedAt);

  await pool.query(
    `UPDATE tasks SET title = $1, description = $2, assignee = $3, priority = $4, status = $5,
       due_date = $6, completed_at = $7, history = $8, updated_at = CURRENT_TIMESTAMP
     WHERE id = $9 AND user_id = $10`,
    [
      next.title,
      next.description || null,
      next.assignee,
      next.priority,
      next.status,
      next.dueDate || null,
      completedAt || null,
      JSON.stringify(history),
      id,
      userId
    ]
  );

  return getTaskById(id, userId);
}

export async function deleteTask(id: string, userId: string): Promise<void> {
  await initDb();
  await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
}
