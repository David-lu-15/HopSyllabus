import { findDateTokens, findTerm, guessTermStart, tokenToIso } from "./dates";
import { extractEvents } from "./events";
import { detectFileKind, extractText } from "./extract-text";
import type { CourseDraft, FileKind, ParseResult } from "../types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const SUPPORTED_FORMATS = "PDF, DOCX, TXT or Markdown";

const COURSE_CODE_PATTERN = /\b([A-Z]{2,6})[\s-]?(\d{2,4}[A-Z]?)\b/;

export class UnsupportedFileError extends Error {}
export class EmptyDocumentError extends Error {}

export type ParseInput = {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  /** Explicit term start (course anchor) used to resolve `Week N` rows. */
  anchorStart?: string | null;
};

/** `ParseResult` plus the full extracted text, which stays on the server. */
export type ParsedDocument = ParseResult & { text: string };

function firstMeaningfulLines(text: string, count: number): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, count);
}

function titleFromFileName(fileName: string): string {
  const base = fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\b(syllabus|course|outline|schedule|20\d{2}|fall|spring|summer|winter)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.length >= 2 ? base : "New course";
}

/**
 * Reads the date from a "term starts / classes end" style line. Handles both
 * "Aug 25 — Classes begin" and "Classes begin on Aug 25", and never crosses a
 * line break (so a footer cannot leak into the next row).
 */
function anchorDateFromTermLine(
  text: string,
  verbs: string,
  yearContext: { anchorYear: number | null },
): string | null {
  const pattern = new RegExp(
    String.raw`\b(classes|lectures|semester|term|course|session)\b[^\n]{0,24}?\b(?:${verbs})\b`,
    "i",
  );

  for (const line of text.split("\n")) {
    if (!pattern.test(line)) continue;
    const token = findDateTokens(line)[0];
    if (token) return tokenToIso(token, yearContext);
  }
  return null;
}

function guessCourse(text: string, fileName: string): CourseDraft {
  const lines = firstMeaningfulLines(text, 18);
  const head = text.slice(0, 2000);
  const draft: CourseDraft = {};

  const codeMatch = COURSE_CODE_PATTERN.exec(head);
  if (codeMatch) draft.code = `${codeMatch[1]} ${codeMatch[2]}`;

  const codeLine = draft.code ? lines.find((line) => line.includes(draft.code!)) : undefined;
  if (codeLine) {
    let remainder = codeLine
      .replace(/^#+\s*/, "")
      .replace(COURSE_CODE_PATTERN, "")
      .replace(/^[\s:–—\-|.,#*]+/, "")
      .replace(/[\s:–—\-|.,#*]+$/, "");
    remainder = remainder
      .replace(/^(?:\.?\d{1,3}|section\s*\d{1,3})\s*[-–—:]*\s*/i, "")
      .trim();
    const withoutTerm = remainder
      .replace(/\b(?:fall|spring|summer|winter)\b/gi, "")
      .replace(/\b20\d{2}\b/g, "")
      .replace(/^[\s:–—\-|.,#*]+/, "")
      .replace(/[\s:–—\-|.,#*]+$/, "")
      .trim();
    if (withoutTerm.length >= 4 && withoutTerm.length <= 90) draft.name = withoutTerm;
  }
  if (!draft.name) {
    const candidate = lines.find(
      (line) =>
        line.length >= 6 &&
        line.length <= 90 &&
        line.split(/\s+/).length >= 2 &&
        findDateTokens(line).length === 0 &&
        !/\b(email|phone|office|semester|credits?|prerequisite|instructor|professor|department|university|college|syllabus)\b/i.test(
          line,
        ),
    );
    if (candidate) draft.name = candidate.replace(/^#+\s*/, "").replace(/^[\s:–—\-|.,#*]+/, "").trim();
  }
  if (!draft.name) draft.name = titleFromFileName(fileName);

  const instructor =
    /\b(?:instructor|professor|prof(?:\.|\b)|lecturer|taught by|teacher)[ \t]*[:\-–]?[ \t]*([^\n]{2,70})/i.exec(
      head,
    ) ?? /\b(Dr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/.exec(head);
  if (instructor) {
    const value = instructor[1]
      .split(/\s{2,}|\||;|\b(?:email|office|phone|hours|zoom|@)\b/i)[0]
      .replace(/[\s:–—\-.,]+$/, "")
      .trim();
    if (value.length >= 2) draft.instructor = value;
  }

  const term = findTerm(head);
  if (term) draft.term = term.label;

  const yearContext = { anchorYear: term?.year ?? null };
  draft.startDate = anchorDateFromTermLine(head, "begin|begins|beginning|start|starts|starting", yearContext);
  draft.endDate = anchorDateFromTermLine(head, "end|ends|ending|finish|finishes|conclude|concludes|last day", yearContext);

  return draft;
}

/** Turns an uploaded syllabus into structured course information + deadlines. */
export async function parseSyllabus(input: ParseInput): Promise<ParsedDocument> {
  const kind: FileKind | null = detectFileKind(input.fileName, input.mimeType);
  if (!kind) {
    throw new UnsupportedFileError(
      `Unsupported file type. Upload a ${SUPPORTED_FORMATS} file.`,
    );
  }
  if (input.buffer.byteLength === 0) {
    throw new EmptyDocumentError("That file looks empty.");
  }

  const text = (await extractText(input.buffer, kind))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  if (text.trim().length === 0) {
    throw new EmptyDocumentError(
      "No text could be read from that file. If it is a scanned PDF, upload a text-based version or add deadlines manually.",
    );
  }

  const course = guessCourse(text, input.fileName);
  const anchorStart = input.anchorStart ?? (course.startDate ?? null);
  const effectiveAnchorStart =
    anchorStart ??
    (course.term
      ? guessTermStart(course.term, findTerm(text)?.year ?? new Date().getFullYear())
      : null);

  const { events, scannedLines } = extractEvents(text, {
    anchorStart: effectiveAnchorStart,
    anchorYear: findTerm(text)?.year ?? null,
  });

  const warnings: string[] = [];
  if (text.trim().length < 400) {
    warnings.push(
      `Only ${text.trim().length} characters of text were found — if this is a scanned PDF, the dates may be incomplete.`,
    );
  }
  if (events.length === 0) {
    warnings.push(
      "No deadlines were detected automatically. You can add them by hand after importing.",
    );
  } else {
    const approximate = events.filter((event) => event.confidence < 0.6).length;
    if (approximate > 0) {
      warnings.push(
        `${approximate} of ${events.length} detected dates are approximate — please review them before saving.`,
      );
    }
    if (scannedLines > 0 && events.length > 250) {
      warnings.push("This syllabus is very long; showing the 250 most relevant dates.");
    }
  }

  return {
    fileName: input.fileName,
    fileType: kind,
    characters: text.length,
    events: events.slice(0, 250),
    course,
    warnings,
    textPreview: text.slice(0, 1500),
    text,
  };
}
