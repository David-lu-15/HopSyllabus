import { randomUUID } from "node:crypto";

import { getDb, transaction } from "./db";
import {
  COURSE_COLORS,
  EVENT_TYPES,
  type Course,
  type CourseEvent,
  type CourseSummary,
  type EventType,
} from "./types";

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  instructor: string | null;
  term: string | null;
  color: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  course_id: string;
  title: string;
  type: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  confidence: number;
  source: string;
  completed: number;
  created_at: string;
};

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    instructor: row.instructor,
    term: row.term,
    color: row.color,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

function toEvent(row: EventRow): CourseEvent {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    type: (EVENT_TYPES as readonly string[]).includes(row.type)
      ? (row.type as EventType)
      : "other",
    dueDate: row.due_date,
    dueTime: row.due_time,
    notes: row.notes,
    confidence: row.confidence,
    source: row.source === "parsed" ? "parsed" : "manual",
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

const EVENT_ORDER = `ORDER BY due_date ASC, COALESCE(due_time, '99:99') ASC, created_at ASC`;
const COURSE_SELECT = `SELECT id, name, code, instructor, term, color, start_date, end_date, created_at FROM courses`;

function eventSelect(): string {
  return `SELECT id, course_id, title, type, due_date, due_time, notes, confidence, source, completed, created_at FROM events`;
}

/* ---------------------------------- courses --------------------------------- */

export function listCourses(): Course[] {
  const rows = getDb()
    .prepare(`${COURSE_SELECT} ORDER BY created_at ASC`)
    .all() as unknown as CourseRow[];
  return rows.map(toCourse);
}

export function listCourseSummaries(): CourseSummary[] {
  const courses = listCourses();
  if (courses.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const counts = getDb()
    .prepare(`SELECT course_id, COUNT(*) AS total FROM events GROUP BY course_id`)
    .all() as unknown as { course_id: string; total: number }[];
  const countByCourse = new Map(counts.map((r) => [r.course_id, r.total]));

  const nextRows = getDb()
    .prepare(
      `SELECT course_id, id, title, type, due_date FROM events
       WHERE due_date >= ?
       ORDER BY due_date ASC, COALESCE(due_time, '99:99') ASC`,
    )
    .all(today) as unknown as {
    course_id: string;
    id: string;
    title: string;
    type: string;
    due_date: string;
  }[];

  const nextByCourse = new Map<string, CourseSummary["nextEvent"]>();
  for (const row of nextRows) {
    if (nextByCourse.has(row.course_id)) continue;
    nextByCourse.set(row.course_id, {
      id: row.id,
      title: row.title,
      type: (EVENT_TYPES as readonly string[]).includes(row.type)
        ? (row.type as EventType)
        : "other",
      dueDate: row.due_date,
    });
  }

  return courses.map((course) => ({
    ...course,
    eventCount: countByCourse.get(course.id) ?? 0,
    nextEvent: nextByCourse.get(course.id) ?? null,
  }));
}

export function getCourse(id: string): Course | null {
  const row = getDb()
    .prepare(`${COURSE_SELECT} WHERE id = ?`)
    .get(id) as unknown as CourseRow | undefined;
  return row ? toCourse(row) : null;
}

export type CourseInput = {
  name: string;
  code?: string | null;
  instructor?: string | null;
  term?: string | null;
  color?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export function createCourse(input: CourseInput): Course {
  const id = randomUUID();
  const color =
    input.color ??
    COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
  getDb()
    .prepare(
      `INSERT INTO courses (id, name, code, instructor, term, color, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.name,
      input.code ?? null,
      input.instructor ?? null,
      input.term ?? null,
      color,
      input.startDate ?? null,
      input.endDate ?? null,
      new Date().toISOString(),
    );
  return getCourse(id)!;
}

export function updateCourse(
  id: string,
  patch: Partial<CourseInput>,
): Course | null {
  const existing = getCourse(id);
  if (!existing) return null;

  const merged: Course = {
    ...existing,
    name: patch.name ?? existing.name,
    code: patch.code === undefined ? existing.code : patch.code,
    instructor:
      patch.instructor === undefined ? existing.instructor : patch.instructor,
    term: patch.term === undefined ? existing.term : patch.term,
    color: patch.color ?? existing.color,
    startDate:
      patch.startDate === undefined ? existing.startDate : patch.startDate,
    endDate: patch.endDate === undefined ? existing.endDate : patch.endDate,
  };

  getDb()
    .prepare(
      `UPDATE courses SET name = ?, code = ?, instructor = ?, term = ?, color = ?, start_date = ?, end_date = ? WHERE id = ?`,
    )
    .run(
      merged.name,
      merged.code,
      merged.instructor,
      merged.term,
      merged.color,
      merged.startDate,
      merged.endDate,
      id,
    );
  return getCourse(id);
}

export function deleteCourse(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM courses WHERE id = ?`).run(id);
  return Number(result.changes) > 0;
}

/* ---------------------------------- events ---------------------------------- */

export function listEvents(courseId?: string): CourseEvent[] {
  const db = getDb();
  const rows = courseId
    ? (db
        .prepare(`${eventSelect()} WHERE course_id = ? ${EVENT_ORDER}`)
        .all(courseId) as unknown as EventRow[])
    : (db
        .prepare(`${eventSelect()} ${EVENT_ORDER}`)
        .all() as unknown as EventRow[]);
  return rows.map(toEvent);
}

export function listEventsForCourses(courseIds: string[]): CourseEvent[] {
  if (courseIds.length === 0) return [];
  const placeholders = courseIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `${eventSelect()} WHERE course_id IN (${placeholders}) ${EVENT_ORDER}`,
    )
    .all(...courseIds) as unknown as EventRow[];
  return rows.map(toEvent);
}

export type EventInput = {
  courseId: string;
  title: string;
  type: EventType;
  dueDate: string;
  dueTime?: string | null;
  notes?: string | null;
  confidence?: number;
  source?: "parsed" | "manual";
};

export function createEvent(input: EventInput): CourseEvent {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO events (id, course_id, title, type, due_date, due_time, notes, confidence, source, completed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      id,
      input.courseId,
      input.title,
      input.type,
      input.dueDate,
      input.dueTime ?? null,
      input.notes ?? null,
      input.confidence ?? 1,
      input.source ?? "manual",
      new Date().toISOString(),
    );
  return getEvent(id)!;
}

export function createEvents(inputs: EventInput[]): CourseEvent[] {
  if (inputs.length === 0) return [];
  return transaction(() => inputs.map(createEvent));
}

export function getEvent(id: string): CourseEvent | null {
  const row = getDb()
    .prepare(`${eventSelect()} WHERE id = ?`)
    .get(id) as unknown as EventRow | undefined;
  return row ? toEvent(row) : null;
}

export function updateEvent(
  id: string,
  patch: {
    title?: string;
    type?: EventType;
    dueDate?: string;
    dueTime?: string | null;
    notes?: string | null;
    completed?: boolean;
  },
): CourseEvent | null {
  const existing = getEvent(id);
  if (!existing) return null;

  const merged = {
    title: patch.title ?? existing.title,
    type: patch.type ?? existing.type,
    dueDate: patch.dueDate ?? existing.dueDate,
    dueTime: patch.dueTime === undefined ? existing.dueTime : patch.dueTime,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
    completed: patch.completed ?? existing.completed,
  };

  getDb()
    .prepare(
      `UPDATE events SET title = ?, type = ?, due_date = ?, due_time = ?, notes = ?, completed = ? WHERE id = ?`,
    )
    .run(
      merged.title,
      merged.type,
      merged.dueDate,
      merged.dueTime,
      merged.notes,
      merged.completed ? 1 : 0,
      id,
    );
  return getEvent(id);
}

export function deleteEvent(id: string): boolean {
  const result = getDb().prepare(`DELETE FROM events WHERE id = ?`).run(id);
  return Number(result.changes) > 0;
}

/* ------------------------------- syllabus files ------------------------------ */

export type SyllabusFile = {
  id: string;
  courseId: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export function saveSyllabusFile(input: {
  courseId: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  text: string;
}): SyllabusFile {
  const id = randomUUID();
  const uploadedAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO syllabus_files (id, course_id, filename, file_type, size_bytes, text, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.courseId,
      input.filename,
      input.fileType,
      input.sizeBytes,
      input.text,
      uploadedAt,
    );
  return { id, uploadedAt, ...input };
}

export function listSyllabusFiles(courseId: string): SyllabusFile[] {
  const rows = getDb()
    .prepare(
      `SELECT id, course_id, filename, file_type, size_bytes, uploaded_at
       FROM syllabus_files WHERE course_id = ? ORDER BY uploaded_at DESC`,
    )
    .all(courseId) as unknown as {
    id: string;
    course_id: string;
    filename: string;
    file_type: string;
    size_bytes: number;
    uploaded_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    filename: row.filename,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  }));
}

/** Widens the course term window so `Week N` dates and year inference stay sane. */
export function refreshCourseBounds(courseId: string): void {
  const row = getDb()
    .prepare(
      `SELECT MIN(due_date) AS first, MAX(due_date) AS last FROM events WHERE course_id = ?`,
    )
    .get(courseId) as unknown as { first: string | null; last: string | null };
  if (!row?.first || !row?.last) return;

  getDb()
    .prepare(
      `UPDATE courses
       SET start_date = COALESCE(start_date, ?),
           end_date   = COALESCE(end_date, ?)
       WHERE id = ?`,
    )
    .run(row.first, row.last, courseId);
}

/* ------------------------------ pending uploads ------------------------------ */

/**
 * Uploads are parsed before the user confirms them, so the extracted text is
 * parked here until the review step is accepted (or the entry expires).
 */
export function savePendingUpload(input: {
  id: string;
  filename: string;
  fileType: string;
  sizeBytes: number;
  text: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO pending_uploads (id, filename, file_type, size_bytes, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.filename,
      input.fileType,
      input.sizeBytes,
      input.text,
      new Date().toISOString(),
    );
}

export function takePendingUpload(id: string): {
  filename: string;
  fileType: string;
  sizeBytes: number;
  text: string;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT filename, file_type, size_bytes, text FROM pending_uploads WHERE id = ?`,
    )
    .get(id) as unknown as
    | { filename: string; file_type: string; size_bytes: number; text: string }
    | undefined;
  if (!row) return null;
  db.prepare(`DELETE FROM pending_uploads WHERE id = ?`).run(id);
  return {
    filename: row.filename,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    text: row.text,
  };
}

export function prunePendingUploads(olderThanHours = 24): void {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000).toISOString();
  getDb().prepare(`DELETE FROM pending_uploads WHERE created_at < ?`).run(cutoff);
}

/* ----------------------------- snapshot restore ----------------------------- */

export function restoreCourse(course: Course): Course {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO courses (id, name, code, instructor, term, color, start_date, end_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      course.id,
      course.name,
      course.code ?? null,
      course.instructor ?? null,
      course.term ?? null,
      course.color,
      course.startDate ?? null,
      course.endDate ?? null,
      course.createdAt,
    );
  return getCourse(course.id)!;
}

export function restoreEvents(events: CourseEvent[]): void {
  if (events.length === 0) return;
  transaction(() => {
    const insert = getDb().prepare(
      `INSERT OR REPLACE INTO events (id, course_id, title, type, due_date, due_time, notes, confidence, source, completed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const e of events) {
      insert.run(
        e.id,
        e.courseId,
        e.title,
        e.type,
        e.dueDate,
        e.dueTime ?? null,
        e.notes ?? null,
        e.confidence ?? 1,
        e.source ?? "parsed",
        e.completed ? 1 : 0,
        e.createdAt ?? new Date().toISOString(),
      );
    }
  });
}

export function restoreCourseSnapshot(snapshot: { course: Course; events: CourseEvent[] }): void {
  restoreCourse(snapshot.course);
  restoreEvents(snapshot.events);
  refreshCourseBounds(snapshot.course.id);
}

