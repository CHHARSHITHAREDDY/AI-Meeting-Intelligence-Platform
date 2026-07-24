import { Pool } from 'pg';

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
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
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

// Meeting-related DB operations (Isolated by User)
export async function getMeetings(userId: string): Promise<Meeting[]> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM meetings WHERE user_id = $1 ORDER BY date DESC', [userId]);
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    duration: row.duration,
    transcript: row.transcript,
    status: row.status,
    analysis: row.analysis || undefined,
    error: row.error || undefined
  }));
}

export async function getMeetingById(id: string, userId: string): Promise<Meeting | null> {
  await initDb();
  const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1 AND user_id = $2', [id, userId]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    duration: row.duration,
    transcript: row.transcript,
    status: row.status,
    analysis: row.analysis || undefined,
    error: row.error || undefined
  };
}

export async function saveMeeting(meeting: Meeting, userId: string): Promise<void> {
  await initDb();
  const { rows } = await pool.query('SELECT id FROM meetings WHERE id = $1 AND user_id = $2', [meeting.id, userId]);
  if (rows.length > 0) {
    await pool.query(
      'UPDATE meetings SET title = $1, date = $2, duration = $3, transcript = $4, status = $5, analysis = $6, error = $7 WHERE id = $8 AND user_id = $9',
      [
        meeting.title,
        meeting.date,
        meeting.duration,
        meeting.transcript,
        meeting.status,
        meeting.analysis ? JSON.stringify(meeting.analysis) : null,
        meeting.error || null,
        meeting.id,
        userId
      ]
    );
  } else {
    await pool.query(
      'INSERT INTO meetings (id, title, date, duration, transcript, status, analysis, error, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        meeting.id,
        meeting.title,
        meeting.date,
        meeting.duration,
        meeting.transcript,
        meeting.status,
        meeting.analysis ? JSON.stringify(meeting.analysis) : null,
        meeting.error || null,
        userId
      ]
    );
  }
}

export async function deleteMeeting(id: string, userId: string): Promise<void> {
  await initDb();
  await pool.query('DELETE FROM meetings WHERE id = $1 AND user_id = $2', [id, userId]);
}

