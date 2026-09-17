import { findDateTokens, findTimeToken, findWeekToken, addDays, tokenToIso, type YearContext } from "./dates";
import { EVENT_TYPE_LABELS, type EventType, type ParsedEvent } from "../types";

/** Which part of the syllabus a line came from — used to weigh relevance. */
type SectionKind =
  | "unknown"
  | "schedule"
  | "assignments"
  | "exams"
  | "projects"
  | "info"
  | "ignore";

const SECTION_PATTERNS: { kind: SectionKind; regex: RegExp }[] = [
  {
    kind: "ignore",
    regex:
      /\b(grading|grade breakdown|grade scale|polic(y|ies)|attendance|office hours|academic (integrity|honesty)|plagiaris|accessibility|accommodat|disability|communication|netiquette|generative ai|ai policy|late work|make-?up policy|classroom conduct|participation|support resources|title ix|counseling|syllabus statement|land acknowledgment)\b/i,
  },
  {
    kind: "projects",
    regex: /\b(project|capstone|portfolio|presentation|deliverable)s?\b/i,
  },
  {
    kind: "exams",
    regex: /\b(exams?|tests?|quizzes|assessments?|evaluation)s?\b/i,
  },
  {
    kind: "assignments",
    regex: /\b(assignments?|homework|problem sets?|papers?|essays?|lab reports?)\b/i,
  },
  {
    kind: "schedule",
    regex:
      /\b(schedule|calendar|tentative|weekly|course plan|topics|outline|timeline|important dates|due dates|deadlines|readings|modules?|class meetings?)\b/i,
  },
  {
    kind: "info",
    regex:
      /\b(course (description|information|overview)|objectives?|outcomes?|prerequisites?|textbook|materials?|learning goals?|instructor|catalog)\b/i,
  },
];

const TYPE_PATTERNS: { type: EventType; regex: RegExp }[] = [
  {
    type: "test",
    regex:
      /\b(final\s+(?:exam|test|assessment)|final\b(?!\s+(?:project|paper|presentation|portfolio|report|essay|proposal))|finals|mid-?terms?|exams?|tests?|blue\s?book|in-?class\s+(?:exam|test|essay)|practicum)\b/i,
  },
  { type: "quiz", regex: /\bquizzes|quiz\b|\bq\d\b/i },
  {
    type: "project",
    regex:
      /\b(projects?|capstone|portfolios?|presentations?|proposals?|milestones?|deliverables?|demonstrations?|demo|thesis|showcase)\b/i,
  },
  {
    type: "assignment",
    regex:
      /\b(assignments?|homework|hw\s?\d|problem sets?|psets?|labs?|worksheets?|essays?|papers?|reports?|write-?ups?|discussion posts?|reflections?|journal|drafts?|responses?|exercises?)\b/i,
  },
  {
    type: "reading",
    regex: /\b(reading|readings|read|chapters?|ch\.?\s?\d)\b/i,
  },
];

const DEADLINE_PATTERN =
  /\b(due|deadline|submit|submission|upload|hand\s?in|turn\s?in|no later than|must be (?:submitted|completed|posted)|ends|closes|opens|take-?home|covers)\b/i;

const TIME_PRESSURE_PATTERN = /\b(by|before|at)\s+\d{1,2}(:\d{2})?\s*([ap]\.?\s?m\.?)?/i;

const NOISE_PATTERN =
  /\b(no class|no classes|holiday|break|campus closed|classes? (?:begin|end|start)|reading day|office hours|final review session|drop deadline|withdraw(al)? deadline|last day to)\b/i;

const ENUMERATOR_PATTERN =
  /^(?:week|wk|module|unit|part|lecture|class|session|day|lesson)\s*\.?\s*\d+\s*[:.|•·\-–—]*\s*/i;

const PAGE_NUMBER_PATTERN = /^(?:page\s*)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?$/i;

export type ExtractOptions = {
  /** "Today" in `YYYY-MM-DD`; defaults to the current date. */
  reference?: string;
  /** First day of the term, used to resolve `Week N` rows. */
  anchorStart?: string | null;
  /** Year of the term, used when a date omits the year. */
  anchorYear?: number | null;
};

export type ExtractResult = {
  events: ParsedEvent[];
  scannedLines: number;
  sectionsSeen: SectionKind[];
};

function classifyType(text: string): EventType {
  for (const { type, regex } of TYPE_PATTERNS) {
    if (regex.test(text)) return type;
  }
  return "other";
}

function sectionFor(line: string): SectionKind | null {
  if (findDateTokens(line).length > 0) return null;
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 72) return null;
  if (/[.!?]$/.test(trimmed)) return null;
  const words = trimmed.split(/\s+/);
  const looksLikeHeading =
    words.length <= 9 &&
    (/^[A-Z0-9][A-Z0-9\s&:,'()\/-]+$/.test(trimmed) ||
      words.every((word) => /^[A-Z(]/.test(word)) ||
      SECTION_PATTERNS.some(({ regex }) => regex.test(trimmed)));
  if (!looksLikeHeading) return null;

  for (const { kind, regex } of SECTION_PATTERNS) {
    if (regex.test(trimmed)) return kind;
  }
  return null;
}

type Line = { text: string; section: SectionKind };

function isDateOnlyLine(text: string): boolean {
  const tokens = findDateTokens(text);
  if (tokens.length === 0) return false;
  let remainder = text;
  for (const token of [...tokens].reverse()) {
    remainder = remainder.slice(0, token.index) + remainder.slice(token.index + token.raw.length);
  }
  const time = findTimeToken(remainder);
  if (time) {
    remainder = remainder.slice(0, time.index) + remainder.slice(time.index + time.raw.length);
  }
  // Only separator punctuation may be left — "Quiz 2 — Oct 30" is a real row.
  return !/[A-Za-z]/.test(remainder);
}

/** PDF text extraction often splits table cells onto separate lines. */
function prepareLines(rawText: string): Line[] {
  const normalised = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  const rawLines = normalised
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0 && !PAGE_NUMBER_PATTERN.test(line));

  // Drop lines that repeat on every page (footers, headers, course codes).
  const counts = new Map<string, number>();
  for (const line of rawLines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const filtered = rawLines.filter(
    (line) => line.length > 24 || (counts.get(line) ?? 0) < 3,
  );

  // Re-join a lone date with the description that follows (or precedes) it.
  const merged: string[] = [];
  for (let index = 0; index < filtered.length; index += 1) {
    const current = filtered[index];
    const next = filtered[index + 1];
    if (
      next &&
      !sectionFor(current) &&
      !sectionFor(next) &&
      next.length < 220 &&
      (isDateOnlyLine(current) || isDateOnlyLine(next))
    ) {
      merged.push(`${current} ${next}`);
      index += 1;
      continue;
    }
    merged.push(current);
  }

  let section: SectionKind = "unknown";
  return merged.map((text) => {
    const detected = sectionFor(text);
    if (detected) section = detected;
    return { text, section };
  });
}

function stripMatched(text: string, spans: { index: number; length: number }[]): string {
  let output = text;
  for (const span of [...spans].sort((a, b) => b.index - a.index)) {
    output = output.slice(0, span.index) + " " + output.slice(span.index + span.length);
  }
  return output;
}

function cleanTitle(line: string, spans: { index: number; length: number }[], fallback: string): string {
  const stripped = stripMatched(line, spans)
    .replace(/\s+/g, " ")
    .replace(/^\s*[\-–—•·*|>]+\s*/, "")
    .trim();

  let title = stripped
    .replace(ENUMERATOR_PATTERN, "")
    // Drop the "due" / "submit" scaffolding that surrounded the date.
    .replace(
      /[\s\-–—:;,.()[\]]*\b(due|deadline|closes|opens|submit(?:ted|s)?|turn(?:ed)? in|no later than)\b[\s:.;,\-–—]*/gi,
      " ",
    )
    // Clock times that survived (e.g. the end of "from 10:00 AM to 12:00 PM").
    .replace(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?\s?m\.?\b/gi, " ")
    .replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, " ")
    // Spaced en/em dashes are separators; hyphens inside words ("Big-O") are not.
    .replace(/\s*([–—])\s*/g, " $1 ")
    .replace(/\s*([–—])\s*[,;]\s*/g, " $1 ")
    .replace(/\s+([,;.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Trim dangling connectors left behind by the removed date ("… due by", "… from to").
  for (let pass = 0; pass < 3; pass += 1) {
    title = title
      .replace(
        /[\s\-–—:;,]*\b(by|at|before|on|until|to|from|between|and|in|the)\b[\s:.;,\-–—]*$/i,
        " ",
      )
      .replace(/[\s\-–—:;,]+$/, "")
      .trim();
  }

  title = title.replace(/^[\s\-–—•·*|>;,]+/, "").trim();

  if (title.length > 110) {
    title = `${title.slice(0, 107).replace(/\s+\S*$/, "")}…`;
  }
  if (title.replace(/[^a-z0-9]/gi, "").length < 3) return fallback;
  if (title.length === 0) return fallback;
  return title[0].toUpperCase() + title.slice(1);
}

function dedupeKey(event: ParsedEvent): string {
  return `${event.dueDate}|${event.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
}

/**
 * Scans syllabus text and returns candidate deadlines.
 *
 * Deliberately conservative: a line only becomes an event when it has both a
 * date and a reason to be a deadline (an assignment/exam/quiz/project keyword
 * or an explicit "due" style phrase).
 */
export function extractEvents(rawText: string, options: ExtractOptions = {}): ExtractResult {
  const lines = prepareLines(rawText);
  const yearContext: YearContext = {
    reference: options.reference,
    anchorYear: options.anchorYear ?? null,
  };
  const anchorStart = options.anchorStart ?? null;

  const found: ParsedEvent[] = [];
  const sectionsSeen = new Set<SectionKind>();

  for (const { text: line, section } of lines) {
    sectionsSeen.add(section);
    if (NOISE_PATTERN.test(line)) continue;

    const dateTokens = findDateTokens(line);
    const timeToken = findTimeToken(line);
    const weekToken = dateTokens.length === 0 ? findWeekToken(line) : null;
    if (dateTokens.length === 0 && !weekToken) continue;

    const type = classifyType(line);
    const deadlineMatch = DEADLINE_PATTERN.exec(line);
    const hasDeadline = Boolean(deadlineMatch) || TIME_PRESSURE_PATTERN.test(line);

    // Reading lists are only deadlines when they say "read by ...".
    if (type === "reading" && !hasDeadline) continue;
    // A bare topic row with a date is a class meeting, not a deadline.
    if (type === "other" && !hasDeadline) continue;
    // Policy sections only yield events when they state a firm deadline.
    if (section === "ignore" && !(hasDeadline && type !== "other")) continue;

    let dueDate: string | null = null;
    let confidence = 0.45;
    const spans: { index: number; length: number }[] = [];

    if (dateTokens.length > 0) {
      let chosen = dateTokens[0];
      if (dateTokens.length > 1 && deadlineMatch) {
        chosen = dateTokens.find((token) => token.index > deadlineMatch.index) ?? dateTokens[dateTokens.length - 1];
      }
      dueDate = tokenToIso(chosen, yearContext);
      for (const token of dateTokens) spans.push({ index: token.index, length: token.raw.length });
      if (chosen.year !== null) confidence += 0.2;
      else confidence += 0.05;
    } else if (weekToken) {
      const start = anchorStart;
      if (!start) continue;
      dueDate = addDays(start, (weekToken.week - 1) * 7);
      confidence = 0.4;
      spans.push({ index: weekToken.index, length: `week ${weekToken.week}`.length });
    }

    if (!dueDate) continue;

    if (timeToken) spans.push({ index: timeToken.index, length: timeToken.raw.length });
    if (deadlineMatch) {
      confidence += 0.1;
      spans.push({ index: deadlineMatch.index, length: deadlineMatch[0].length });
    }
    if (type !== "other") confidence += 0.15;
    if (["schedule", "assignments", "exams", "projects"].includes(section)) confidence += 0.12;
    if (timeToken) confidence += 0.05;

    const fallback = type === "other" ? "Deadline" : EVENT_TYPE_LABELS[type];
    const title = cleanTitle(line, spans, fallback);
    const raw = line.length > 400 ? `${line.slice(0, 397)}…` : line;

    found.push({
      title,
      type,
      dueDate,
      dueTime: timeToken?.time ?? null,
      notes: raw,
      confidence: Math.max(0.2, Math.min(0.98, Number(confidence.toFixed(2)))),
      raw,
    });
  }

  const seen = new Set<string>();
  const events = found
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.confidence - a.confidence)
    .filter((event) => {
      const key = dedupeKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { events, scannedLines: lines.length, sectionsSeen: [...sectionsSeen] };
}
