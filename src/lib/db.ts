import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createPool } from "@vercel/postgres";

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
    process.env.HOPSYLLABUS_DATA_DIR ??
    path.join(process.cwd(), ".data");
  return path.join(dir, "hopsyllabus.db");
}

function connectSqlite(): DatabaseSync {
  const file = databasePath();
  if (process.env.VERCEL && !hasPostgres()) {
    // Vercel's filesystem is read-only apart from /tmp, and /tmp is private to a
    // single instance, so this deployment cannot share data between requests.
    console.error(
      "No hosted database is configured: falling back to %s. Courses saved by " +
        "one request will not be visible to the next. Set DATABASE_URL (Neon) " +
        "or POSTGRES_URL in the project's environment variables.",
      file,
    );
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

type Row = Record<string, unknown>;
type SqliteValue = string | number | bigint | null | Uint8Array;
export type QueryFn = <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T[]>;

const globalForDb = globalThis as typeof globalThis & {
  __hopsyllabusDb?: DatabaseSync;
  __hopsyllabusPool?: ReturnType<typeof createPool>;
  __hopsyllabusReady?: Promise<void>;
};

/**
 * Connection string for the hosted database.
 *
 * The Neon integration exposes `DATABASE_URL` (pooled) and
 * `DATABASE_URL_UNPOOLED`; the older Vercel Postgres store used
 * `POSTGRES_URL`/`POSTGRES_URL_NON_POOLING`. Accept either naming, otherwise a
 * project with only one of them silently falls back to a per-instance file.
 */
function connectionString(): string | undefined {
  return (
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED
  );
}

function hasPostgres(): boolean {
  return Boolean(connectionString());
}

/** Which storage this instance is actually talking to. */
export function storageBackend(): "postgres" | "sqlite" {
  return hasPostgres() ? "postgres" : "sqlite";
}

function toPostgresQuery(sql: string): string {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`);
}

function isReadQuery(sql: string): boolean {
  return /^\s*(SELECT|WITH|PRAGMA)/i.test(sql);
}

function getDb(): DatabaseSync {
  if (!globalForDb.__hopsyllabusDb) globalForDb.__hopsyllabusDb = connectSqlite();
  return globalForDb.__hopsyllabusDb;
}

function getPool() {
  if (!globalForDb.__hopsyllabusPool) {
    globalForDb.__hopsyllabusPool = createPool({
      connectionString: connectionString(),
    });
  }
  return globalForDb.__hopsyllabusPool;
}

async function ensureReady(): Promise<void> {
  if (!hasPostgres()) return;
  if (!globalForDb.__hopsyllabusReady) {
    globalForDb.__hopsyllabusReady = (async () => {
      const statements = SCHEMA.split(";").map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await getPool().query(statement);
    })();
  }
  await globalForDb.__hopsyllabusReady;
}

export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureReady();
  if (hasPostgres()) {
    const result = await getPool().query(toPostgresQuery(sql), params);
    return result.rows as T[];
  }
  return getDb().prepare(sql).all(...params as SqliteValue[]) as unknown as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<number> {
  await ensureReady();
  if (hasPostgres()) return (await getPool().query(toPostgresQuery(sql), params)).rowCount ?? 0;
  return Number(getDb().prepare(sql).run(...params as SqliteValue[]).changes);
}

export async function transaction<T>(fn: (transactionQuery: QueryFn) => Promise<T>): Promise<T> {
  await ensureReady();
  if (!hasPostgres()) {
    const db = getDb();
    db.exec("BEGIN");
    const transactionQuery: QueryFn = async <R extends Row = Row>(sql: string, params: unknown[] = []) => {
      const statement = db.prepare(sql);
      if (isReadQuery(sql)) return statement.all(...params as SqliteValue[]) as unknown as R[];
      statement.run(...params as SqliteValue[]);
      return [];
    };
    try {
      const result = await fn(transactionQuery);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const client = await getPool().connect();
  await client.sql`BEGIN`;
  const transactionQuery: QueryFn = async <R extends Row = Row>(sql: string, params: unknown[] = []) =>
    (await client.query(toPostgresQuery(sql), params)).rows as R[];
  try {
    const result = await fn(transactionQuery);
    await client.sql`COMMIT`;
    return result;
  } catch (error) {
    await client.sql`ROLLBACK`;
    throw error;
  } finally {
    client.release();
  }
}
