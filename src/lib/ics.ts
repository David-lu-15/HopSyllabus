import { EVENT_TYPE_LABELS, type Course, type CourseEvent } from "./types";

/** Escapes a value for an iCalendar TEXT property (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds long lines at 75 octets so clients can parse them (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.byteLength <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > 73) {
      chunks.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n ");
}

/** `DTSTAMP` must be a UTC timestamp (RFC 5545 §3.8.7.2). */
function stamp(iso: string): string {
  return `${iso.replace(/[-:]/g, "").slice(0, 15).padEnd(15, "0")}Z`;
}

function dateValue(event: CourseEvent): string {
  const date = event.dueDate.replace(/-/g, "");
  if (!event.dueTime) return `DTSTART;VALUE=DATE:${date}`;
  return `DTSTART:${date}T${event.dueTime.replace(":", "")}00`;
}

export function buildCalendar(course: Course, events: CourseEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HopSyllabus//Course deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(`${course.code ? `${course.code} — ` : ""}${course.name}`)}`),
  ];

  for (const event of events) {
    const summary = `${course.code ? `[${course.code}] ` : ""}${event.title}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@hopsyllabus`,
      `DTSTAMP:${stamp(event.createdAt)}`,
      dateValue(event),
      fold(`SUMMARY:${escapeText(`${EVENT_TYPE_LABELS[event.type]}: ${summary}`)}`),
    );
    if (event.notes) {
      lines.push(fold(`DESCRIPTION:${escapeText(event.notes)}`));
    }
    lines.push(
      fold(`CATEGORIES:${escapeText(EVENT_TYPE_LABELS[event.type])}`),
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      event.type === "test" || event.type === "quiz" ? "TRIGGER:-P3D" : "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${escapeText(summary)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
