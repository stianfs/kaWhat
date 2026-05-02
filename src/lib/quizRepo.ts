import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { SavedQuiz, QuizQuestion } from './types';

interface QuizRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  is_public: number;
  title: string;
  questions: string;
  created_at: string;
  updated_at: string;
}

function rowToQuiz(row: QuizRow): SavedQuiz {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    userName: row.user_name || undefined,
    isPublic: row.is_public === 1,
    title: row.title,
    questions: JSON.parse(row.questions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listQuizzesByUser(userId: string): SavedQuiz[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId) as QuizRow[];
  return rows.map(rowToQuiz);
}

export function listPublicQuizzes(search?: string): SavedQuiz[] {
  const db = getDb();
  if (search) {
    const pattern = `%${search}%`;
    const rows = db.prepare(
      'SELECT * FROM quizzes WHERE is_public = 1 AND (title LIKE ? OR questions LIKE ?) ORDER BY updated_at DESC'
    ).all(pattern, pattern) as QuizRow[];
    return rows.map(rowToQuiz);
  }
  const rows = db.prepare(
    'SELECT * FROM quizzes WHERE is_public = 1 ORDER BY updated_at DESC'
  ).all() as QuizRow[];
  return rows.map(rowToQuiz);
}

export function getQuizById(id: string): SavedQuiz | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as QuizRow | undefined;
  return row ? rowToQuiz(row) : null;
}

export function createQuiz(opts: {
  userId?: string;
  userName?: string;
  isPublic: boolean;
  title: string;
  questions: QuizQuestion[];
}): SavedQuiz {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(
    'INSERT INTO quizzes (id, user_id, user_name, is_public, title, questions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    opts.userId || null,
    opts.userName || null,
    opts.isPublic ? 1 : 0,
    opts.title,
    JSON.stringify(opts.questions),
    now,
    now
  );

  return {
    id,
    userId: opts.userId,
    userName: opts.userName,
    isPublic: opts.isPublic,
    title: opts.title,
    questions: opts.questions,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateQuiz(id: string, userId: string, opts: {
  title: string;
  questions: QuizQuestion[];
}): SavedQuiz | null {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db.prepare(
    'UPDATE quizzes SET title = ?, questions = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(opts.title, JSON.stringify(opts.questions), now, id, userId);

  if (result.changes === 0) return null;
  return getQuizById(id);
}

export function deleteQuiz(id: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM quizzes WHERE id = ? AND user_id = ?'
  ).run(id, userId);
  return result.changes > 0;
}
