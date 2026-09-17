import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT,
  instructor  TEXT,
  term        TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS syllabus_files (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  due_date    TEXT NOT NULL,
  due_time    TEXT,
  notes       TEXT,
  confidence  REAL NOT NULL DEFAULT 1,
  source      TEXT NOT NULL DEFAULT 'manual',
  completed   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_course_date ON events (course_id, due_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events (due_date);
CREATE INDEX IF NOT EXISTS idx_syllabus_course ON syllabus_files (course_id, uploaded_at DESC);

-- Parsed uploads waiting for the user to confirm them in the review step.
CREATE TABLE IF NOT EXISTS pending_uploads (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
`;

export function databasePath(): string {
  const dir =
    process.env.HOPSYLLABUS_DATA_DIR ?? path.join(process.cwd(), ".data");
  return path.join(dir, "hopsyllabus.db");
}

function connect(): DatabaseSync {
  const file = databasePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

// Next.js dev mode re-evaluates modules on hot reload, so keep a single
// connection on the global object instead of opening a new handle per reload.
const globalForDb = globalThis as typeof globalThis & {
  __hopsyllabusDb?: DatabaseSync;
};

export function getDb(): DatabaseSync {
  if (!globalForDb.__hopsyllabusDb) {
    globalForDb.__hopsyllabusDb = connect();
  }
  return globalForDb.__hopsyllabusDb;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
