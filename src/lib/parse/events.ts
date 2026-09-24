import { findDateTokens, findTimeToken, findWeekToken, addDays, resolveDayOfWeek, tokenToIso, type YearContext } from "./dates";
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
      /\b(final\s+(?:exam|test|assessment)|final\b(?!\s+(?:project|paper|presentation|portfolio|report|essay|proposal|reflection|problem\s+set|pset|homework|hw|assignment|quiz|submission|draft|term|week))|finals|mid-?terms?|exams?|tests?|blue\s?book|in-?class\s+(?:exam|test|essay)|practicum)\b/i,
  },
  { type: "quiz", regex: /\bquizzes|quiz\b|\bq\d\b/i },
  {
    type: "reading",
    regex:
      /\b(?:read(?:ings?|\b)|listen|browse|podcasts?|podcast\s+episodes?|excerpts?|articles?|chapters?|ch\.\s*\d+|pages?|pp\.\s*\d+|resource)\b|["“][^"”]{3,}["”]/i,
  },
  {
    type: "project",
    regex:
      /\b(projects?|capstone|portfolios?|presentations?|proposals?|milestones?|deliverables?|demonstrations?|demo|thesis|showcase|posters?)\b/i,
  },
  {
    type: "assignment",
    regex:
      /\b(assignments?|homework|hw\s?\d|problem sets?|psets?|labs?|worksheets?|essays?|papers?|reports?|write-?ups?|discussion posts?|reflections?|journal|drafts?|responses?|exercises?|surveys?|memos?|peer\s+(?:feedback|review)s?|bring\s+in|annotations?|analysis|analyses)\b/i,
  },
];

const DEADLINE_PATTERN =
  /\b(due|deadline|submit|submission|upload|hand\s?in|turn\s?in|no later than|must be (?:submitted|completed|posted)|ends|closes|opens|take-?home|covers|calendar event|bring\s+in)\b/i;

const TIME_PRESSURE_PATTERN =
  /\b(?:(?:by|before|at|@)\s+(?:\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?|[ap]\b)?|midnight|noon)|(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*(?:to|[-–—])\s*\d{1,2}(?::\d{2})?\s*([ap]\.?\s?m\.?)|(?:\bfrom\s+\d{1,2}(?::\d{2})?\s+to\s+\d{1,2}(?::\d{2})?))/i;

const NOISE_PATTERN =
  /\b(no class|no classes|holiday|break|campus closed|classes? (?:begin|end|start)|reading day|office hours|final review session|drop deadline|withdraw(al)? deadline|last day to (?:add|drop|withdraw|register|enroll|audit|change))\b/i;

const ENUMERATOR_PATTERN =
  /^(?:week|wk|module|unit|part|lecture|class|session|day|lesson|final\s+term|term)\s*\.?\s*(?:\d+|[ivxlcdm]+)?\s*[:.|•·\-–—]*\s*/i;

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
  if (
    /\b(?:read(?:ings?|\b)|listen|browse|podcasts?|podcast\s+episodes?|excerpts?|articles?|resource)\b|["“][^"”]{3,}["”]/i.test(
      text,
    ) &&
    !DEADLINE_PATTERN.test(text)
  ) {
    return "reading";
  }
  for (const { type, regex } of TYPE_PATTERNS) {
    if (regex.test(text)) return type;
  }
  return "other";
}

function sectionFor(line: string): SectionKind | null {
  if (findDateTokens(line).length > 0) return null;
  if (findTimeToken(line) !== null) return null;
  if (DEADLINE_PATTERN.test(line)) return null;

  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 72) return null;
  if (/[.!?]$/.test(trimmed)) return null;

  if (/^(?:mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)\b/i.test(trimmed)) {
    return null;
  }
  if (/^\b(?:work(?:ing)?\s+on|read\b|listen\b|bring\b)/i.test(trimmed)) {
    return null;
  }

  if (/^(?:assignment|quiz|exam|test|hw|homework|project|calendar event)\b/i.test(trimmed)) {
    if (!/^(?:assignments?|homework|exams?|quizzes|projects?|calendar|schedule)$/i.test(trimmed)) {
      return null;
    }
  }

  if (/\bpolicy briefs?\b/i.test(trimmed)) return null;
  if (/^[a-z]+$/.test(trimmed)) return null;

  const words = trimmed.split(/\s+/);
  const looksLikeHeading =
    words.length <= 9 &&
    (/^[A-Z0-9][A-Z0-9\s&:,'()\/-]+$/.test(trimmed) ||
      words.every((word) => /^[A-Z(]/.test(word)));
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
  // Strip secondary day ranges: "& 3", "- 10", "and 15", "to 22", etc.
  remainder = remainder.replace(/(?:&|and|to|through|thru|[-–—])\s*\d{1,2}(?:st|nd|rd|th)?\b/gi, "");
  for (const token of [...findDateTokens(remainder)].reverse()) {
    remainder = remainder.slice(0, token.index) + remainder.slice(token.index + token.raw.length);
  }
  const time = findTimeToken(remainder);
  if (time) {
    remainder = remainder.slice(0, time.index) + remainder.slice(time.index + time.raw.length);
  }
  // Strip day names, punctuation, and whitespace
  remainder = remainder
    .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(and|to|through|thru)\b/gi, "")
    .replace(/\b(?:week|wk)\s*\d+\b/gi, "")
    .replace(/[\s:–—\-|.,&/\\()[\]]+/g, "");
  return remainder.length === 0;
}

function isTimeOnlyLine(text: string): boolean {
  if (!/\d/.test(text)) return false;
  const stripped = text
    .replace(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?\s?m\.?\b/gi, "")
    .replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, "")
    .replace(/\b(due|by|at|before|to|from|until|between|and|pm|am|est|cst|pst|mst|edt|cdt|pdt|mdt)\b/gi, "")
    .replace(/[\s:–—\-|.,]+/g, "");
  return stripped.length === 0;
}

/** PDF and DOCX text extraction often splits table cells onto separate lines. */
function prepareLines(rawText: string): Line[] {
  const normalised = rawText
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/([ap]\.?m\.?)(to|[-–—])/gi, "$1 $2 ");

  const rawLines = normalised
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0 && !PAGE_NUMBER_PATTERN.test(line));

  const splitLines: string[] = [];
  for (const line of rawLines) {
    if (!line.includes(";")) {
      splitLines.push(line);
      continue;
    }

    const sessionPrefixMatch =
      /^(?:[-*+•·]\s*)?((?:Session|Week|Wk|Module|Unit|Part|Lecture|Class)\s*(?:\d+|[ivxlcdm]+)\b[^\n:]*:\s*)(.*)$/i.exec(
        line,
      );

    if (sessionPrefixMatch) {
      const prefix = sessionPrefixMatch[1];
      const remainder = sessionPrefixMatch[2];
      const parts = remainder.split(/;\s*/);

      if (parts.length > 1) {
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 0) {
            splitLines.push(`${prefix}${trimmed}`);
          }
        }
        continue;
      }
    }

    const parts = line.split(/;\s*(?=[A-Za-z0-9])/);
    if (parts.length > 1 && (findDateTokens(line).length > 1 || (line.match(/\bdue\b/gi) || []).length > 1)) {
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 0) {
          splitLines.push(trimmed);
        }
      }
      continue;
    }

    splitLines.push(line);
  }

  // If a table row split across a page break (e.g. "Week 4 ... Tues: Read..." followed by date "Sep 22 & 24"),
  // place the date line first so it anchors the week's dates.
  for (let i = 0; i < splitLines.length - 1; i++) {
    if (
      /^(?:week|wk)\s*\d+\s+\S+/i.test(splitLines[i]) &&
      findDateTokens(splitLines[i]).length === 0 &&
      isDateOnlyLine(splitLines[i + 1])
    ) {
      const temp = splitLines[i];
      splitLines[i] = splitLines[i + 1];
      splitLines[i + 1] = temp;
      i++;
    }
  }

  // Drop lines that repeat on every page (footers, headers, course codes),
  // but NEVER drop lines that contain dates, times, or deadline indicators.
  const counts = new Map<string, number>();
  for (const line of splitLines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const filtered = splitLines.filter((line) => {
    if (line.length > 24 || (counts.get(line) ?? 0) < 3) return true;
    if (findDateTokens(line).length > 0) return true;
    if (findTimeToken(line) !== null) return true;
    if (DEADLINE_PATTERN.test(line) || TIME_PRESSURE_PATTERN.test(line)) return true;
    return false;
  });

  // Table cell assembly:
  // 1. Merge trailing time-only lines, day prefixes, unclosed quotes, or unclosed parentheses
  const withTimesMerged: string[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i];
    const prev = withTimesMerged[withTimesMerged.length - 1];
    if (isTimeOnlyLine(line) && withTimesMerged.length > 0) {
      withTimesMerged[withTimesMerged.length - 1] += ` ${line}`;
    } else if (
      withTimesMerged.length > 0 &&
      !isDateOnlyLine(line) &&
      findDateTokens(line).length === 0 &&
      !/^(?:week|wk)\s*\d+/i.test(line) &&
      !sectionFor(line) &&
      (/^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\s*[:\-–—]?$/i.test(prev) ||
        (prev.match(/"/g) || []).length % 2 === 1 ||
        (prev.match(/\(/g) || []).length > (prev.match(/\)/g) || []).length ||
        (prev.endsWith("-") && /^[a-z]/i.test(line)) ||
        (!/[.!?:]$/.test(prev) && /^[a-z]/.test(line)))
    ) {
      if (prev.endsWith("-")) {
        withTimesMerged[withTimesMerged.length - 1] += line;
      } else {
        withTimesMerged[withTimesMerged.length - 1] += ` ${line}`;
      }
    } else {
      withTimesMerged.push(line);
    }
  }

  // 2. Associate date-only rows with following items (table row distribution)
  const expanded: string[] = [];
  let currentDatePrefix: string | null = null;
  let currentDayPrefix: string | null = null;
  for (let i = 0; i < withTimesMerged.length; i++) {
    let line = withTimesMerged[i];
    const sec = sectionFor(line);
    if (sec && (sec === "ignore" || sec === "info" || sec === "schedule")) {
      currentDatePrefix = null;
      currentDayPrefix = null;
      expanded.push(line);
      continue;
    }
    if (/^(?:week|wk|module|unit|session|lecture|part)\s*\d+$/i.test(line)) {
      currentDatePrefix = null;
      currentDayPrefix = null;
      expanded.push(line);
      continue;
    }
    if (isDateOnlyLine(line)) {
      currentDatePrefix = line;
      currentDayPrefix = null;
      continue;
    }
    if (currentDatePrefix) {
      if (findDateTokens(line).length > 0) {
        currentDatePrefix = null;
        currentDayPrefix = null;
        expanded.push(line);
      } else {
        line = line.replace(/^&\s*/, "");
        const dayMatch = new RegExp(
          String.raw`^(?:[A-Za-z0-9\s&,/-]*?)\b(${DAY_NAME_PATTERN.source})\s*[:\-–—]`,
          "i",
        ).exec(line);

        if (dayMatch) {
          currentDayPrefix = dayMatch[1];
          expanded.push(`${currentDatePrefix} ${line}`);
        } else if (findDayOfWeekInDeadline(line)) {
          expanded.push(`${currentDatePrefix} ${line}`);
        } else if (currentDayPrefix) {
          expanded.push(`${currentDatePrefix} ${currentDayPrefix}: ${line}`);
        } else {
          expanded.push(`${currentDatePrefix} ${line}`);
        }
      }
    } else {
      expanded.push(line);
    }
  }

  let section: SectionKind = "unknown";
  return expanded.map((text) => {
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

const DAY_NAME_PATTERN =
  /\b(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs|r)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;

function findDayOfWeekInDeadline(line: string): string | null {
  // 1. "due (on) <day>" e.g. "due Sunday 12pm", "due Tuesday end of class", "Due Sunday"
  const dueDay = new RegExp(String.raw`\bdue\s+(?:on\s+)?(${DAY_NAME_PATTERN.source})`, "i").exec(line);
  if (dueDay) return dueDay[1];

  // 2. "<day>: ..." e.g. "Tues: Peer feedback due at 10am"
  const prefixDay = new RegExp(
    String.raw`^(?:[A-Za-z0-9\s&,/-]*?)\b(${DAY_NAME_PATTERN.source})\s*[:\-–—]`,
    "i",
  ).exec(line);
  if (prefixDay) return prefixDay[1];

  // 3. "<day> <time>" e.g. "Sunday 12pm", "Tuesday at 10am"
  const dayTime = new RegExp(
    String.raw`\b(${DAY_NAME_PATTERN.source})\s+(?:at\s+|by\s+)?\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?`,
    "i",
  ).exec(line);
  if (dayTime) return dayTime[1];

  return null;
}

function cleanTitle(line: string, spans: { index: number; length: number }[], fallback: string): string {
  let stripped = stripMatched(line, spans);

  // If a table row has "<Class Topic> <Day>: <Assignment>", focus on the assignment part
  const dayColMatch = new RegExp(String.raw`\b${DAY_NAME_PATTERN.source}\s*[:\-–—]\s*(.*)$`, "i").exec(stripped);
  if (dayColMatch) {
    if (DEADLINE_PATTERN.test(dayColMatch[1]) || TYPE_PATTERNS.some((p) => p.regex.test(dayColMatch[1]))) {
      stripped = dayColMatch[1];
    }
  }

  // Strip markdown formatting, links, and checkboxes
  stripped = stripped
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [Link Title](url) -> Link Title
    .replace(/^[\s\-*+]*\[[ xX]\]\s*/, "") // - [ ] or - [x]
    .replace(/[*_]{1,3}/g, "") // **bold**, *italic*
    .replace(/^\|+|\|+$/g, "") // table pipe borders
    .replace(/\|+/g, " - ") // table cell separators
    .replace(/\(\s*[-–—/]*\s*\)/g, " ") // empty parens left by removed dates
    .replace(/\[\s*[-–—/]*\s*\]/g, " ") // empty brackets left by removed dates
    .replace(
      /\s*(?:\((?:submit|turn\s*in|upload)?\s*)?(?:on|via|through|to)\s+(?:gradescope|canvas|blackboard|github|drive)[^)]*\)?/gi,
      " ",
    )
    .replace(/\b(?:est|edt|pst|pdt|cst|cdt|mst|mdt|utc|gmt)\b/gi, " ");

  let title = stripped
    .replace(/\s+/g, " ")
    .replace(/^\s*[\-–—•·*|>]+\s*/, "")
    .trim();

  // Deduplicate identical repeated phrases like "Topic Tues: Topic"
  const dupeMatch = /^(.*?)\s+\b(?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*\s*[:\-–—]\s*\1$/i.exec(title);
  if (dupeMatch) {
    title = dupeMatch[1];
  }

  title = title
    .replace(ENUMERATOR_PATTERN, "")
    .replace(/^(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs|r)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*[:\-–—,.]*\s*/i, "")
    .replace(/^(?:assignment\s+(?=[A-Za-z])|calendar\s+event\s*[:-]?\s*)/i, "")
    .replace(/\b(?:thanksgiving|fall|spring|winter)\s+break\b/gi, " ")
    .replace(/\bfinals?\s+week\s+/gi, " ")
    .replace(/^.*?\bwork(?:ing)?\s+on[^\n.!?]*[.!?]\s*/i, "")
    .replace(
      /[\s\-–—:;,.()[\]]*\b(due|deadline|closes|opens|turn(?:ed)? in|no later than)\b[\s:.;,\-–—]*(?:(?:on|by|at|in|during|end of|@)\s+)?(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs|r)?|fri(?:day)?|sat(?:urday)?|sun(?:day)|class|final\s+exam(?:\s+period)?)?[\s:.;,\-–—]*/gi,
      " ",
    )
    .replace(
      /\b(submit(?:ted|s)?)\s+(?:by|at|before|on|until|to|from)\b/gi,
      " ",
    )
    .replace(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?\s?m\.?\b/gi, " ")
    .replace(/\b([01]?\d|2[0-3]):[0-5]\d\b/g, " ")
    .replace(/\b(?:during|in|at)\s+(?:the\s+)?final\s+exam(?:\s+period)?\b/gi, " ")
    .replace(/\b(?:end\s+of\s+(?:the\s+)?(?:class|day)|class\s+period)\b/gi, " ")
    .replace(/\b(?:in|during)\s+class\b/gi, " ")
    .replace(/\s+@\s*(?=[(\[A-Z0-9])/g, " ")
    .replace(/\s*([–—])\s*/g, " $1 ")
    .replace(/\s*([–—])\s*[,;]\s*/g, " $1 ")
    .replace(/\s+([,;.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If there is an unclosed parenthesis at the end (e.g. truncated "(On Spotify..."), strip it
  if ((title.match(/\(/g) || []).length > (title.match(/\)/g) || []).length) {
    title = title.replace(/\s*\([^)]*$/, "").trim();
  }

  // Trim dangling connectors left behind by the removed date ("… due by", "… from to", "@").
  for (let pass = 0; pass < 4; pass += 1) {
    title = title
      .replace(
        /[\s\-–—:;,@]*\b(by|at|before|on|until|to|from|between|and|in|the|due|end of|during)\b[\s:.;,\-–—@]*$/i,
        " ",
      )
      .replace(
        /[\s\-–—:;,@]*\b(?:mon(?:day)?|tue(?:sday|s)?|wed(?:nesday)?|thu(?:rsday|rs|r)?|fri(?:day)?|sat(?:urday)?|sun(?:day))\b[\s:.;,\-–—@]*$/i,
        " ",
      )
      .replace(/[\s\-–—:;,@([\]]+$/, "")
      .trim();
  }

  title = title.replace(/^[\s\-–—•·*|>;,&@:]+/, "").trim();

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
    if (NOISE_PATTERN.test(line) && !DEADLINE_PATTERN.test(line)) continue;
    if (/\b(?:work(?:ing)?\s+on|workshop)\b/i.test(line) && !DEADLINE_PATTERN.test(line)) continue;

    const dateTokens = findDateTokens(line);
    const timeToken = findTimeToken(line);
    const weekToken = dateTokens.length === 0 ? findWeekToken(line) : null;
    if (dateTokens.length === 0 && !weekToken) continue;

    const type = classifyType(line);
    const deadlineMatch = (/\bdue\b/i.exec(line)) ?? DEADLINE_PATTERN.exec(line);
    const hasDeadline = Boolean(deadlineMatch) || TIME_PRESSURE_PATTERN.test(line);
    const isScheduledReading = type === "reading" && Boolean(findDayOfWeekInDeadline(line));

    // Reading lists are only deadlines when they say "read by ..." or are scheduled for a specific day.
    if (type === "reading" && !hasDeadline && !isScheduledReading) continue;
    // A bare topic row with a date is a class meeting, not a deadline.
    if (type === "other" && !hasDeadline) continue;
    // Bare project lines without deliverable intent are topics, not events
    if (type === "project" && !hasDeadline && !/\b(presentations?|proposals?|milestones?|deliverables?|demos?|showcase)\b/i.test(line)) {
      continue;
    }
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

      const dayName = findDayOfWeekInDeadline(line);
      if (dayName && dueDate) {
        const anchorDate = tokenToIso(dateTokens[0], yearContext);
        if (anchorDate) {
          dueDate = resolveDayOfWeek(anchorDate, dayName);
        }
      }
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
      type: isScheduledReading ? "assignment" : (type === "other" && deadlineMatch ? "assignment" : type),
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
