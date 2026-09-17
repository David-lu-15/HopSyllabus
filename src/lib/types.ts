export const EVENT_TYPES = [
  "assignment",
  "test",
  "quiz",
  "project",
  "reading",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  assignment: "Assignment",
  test: "Test / Exam",
  quiz: "Quiz",
  project: "Project",
  reading: "Reading",
  other: "Other",
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  assignment: "#6366f1",
  test: "#f43f5e",
  quiz: "#f59e0b",
  project: "#10b981",
  reading: "#0ea5e9",
  other: "#94a3b8",
};

/** Tailwind classes used by the type chips in the UI. */
export const EVENT_TYPE_CHIP: Record<EventType, string> = {
  assignment: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30",
  test: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  quiz: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  project: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  reading: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  other: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

export const COURSE_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#a855f7",
] as const;

export type Course = {
  id: string;
  name: string;
  code: string | null;
  instructor: string | null;
  term: string | null;
  color: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type CourseSummary = Course & {
  eventCount: number;
  nextEvent: Pick<CourseEvent, "id" | "title" | "type" | "dueDate"> | null;
};

export type CourseEvent = {
  id: string;
  courseId: string;
  title: string;
  type: EventType;
  /** ISO calendar date, `YYYY-MM-DD`, kept timezone-free on purpose. */
  dueDate: string;
  /** 24h `HH:MM`, or null when the syllabus only lists a date. */
  dueTime: string | null;
  notes: string | null;
  confidence: number;
  source: "parsed" | "manual";
  completed: boolean;
  createdAt: string;
};

export type ParsedEvent = {
  title: string;
  type: EventType;
  dueDate: string;
  dueTime: string | null;
  notes: string | null;
  confidence: number;
  /** The raw syllabus line the event was derived from, shown in the review step. */
  raw: string;
};

export type CourseDraft = {
  name?: string | null;
  code?: string | null;
  instructor?: string | null;
  term?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type FileKind = "pdf" | "docx" | "text";

export type ParseResult = {
  fileName: string;
  fileType: FileKind;
  characters: number;
  events: ParsedEvent[];
  course: CourseDraft;
  warnings: string[];
  textPreview: string;
};
