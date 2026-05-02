import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    ensureDataDir();
    const dbPath = path.join(DATA_DIR, 'kawhat.db');
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      questions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes(is_public);
  `);
}
