/**
 * Date/time extraction helpers.
 *
 * Syllabi express dates in wildly inconsistent ways ("Sept. 3", "09/03/2026",
 * "Week 4", "the Friday of week 6"), so we scan for every recognisable token
 * first and decide later which one is the real deadline.
 */

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MONTH_WORD = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const ORDINAL = "(?:st|nd|rd|th)?";

export type DateToken = {
  year: number | null;
  month: number;
  day: number;
  raw: string;
  /** Character offset inside the scanned string. */
  index: number;
  /** True when the source was an unambiguous numeric format. */
  numeric: boolean;
};

export type TimeToken = {
  time: string;
  raw: string;
  index: number;
};

function monthFromWord(word: string): number | null {
  const clean = word.toLowerCase().replace(/\./g, "");
  if (clean.length < 3) return null;
  const found = MONTH_NAMES.findIndex(
    (name) => name === clean || name.startsWith(clean),
  );
  return found === -1 ? null : found + 1;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function normaliseYear(value: number): number | null {
  if (value >= 100) return value >= 1900 && value <= 2100 ? value : null;
  // Two digit years: 00-79 => 2000s, 80-99 => 1900s (never happens in practice).
  return value < 80 ? 2000 + value : 1900 + value;
}

/** Finds every date-looking token in a string of text. */
export function findDateTokens(text: string): DateToken[] {
  const tokens: DateToken[] = [];
  const push = (token: Omit<DateToken, "index">, index: number) => {
    tokens.push({ ...token, index });
  };

  const patterns: {
    regex: RegExp;
    build: (match: RegExpExecArray) => Omit<DateToken, "index"> | null;
  }[] = [
    {
      // 2026-09-03
      regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      build: (m) => {
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        return isValidYmd(year, month, day)
          ? { year, month, day, raw: m[0], numeric: true }
          : null;
      },
    },
    {
      // 9/3/2026, 09-03-26, 9.3, 9/14 & 16, 9/14 - 9/16
      regex: /\b(\d{1,2})[/.-](\d{1,2})(?:\s*(?:&|and|to|through|thru|[-–—])\s*(\d{1,2}))?(?:[/.-](\d{2,4}))?\b/g,
      build: (m) => {
        const month = Number(m[1]);
        const day = Number(m[2]);
        const year = m[4] ? normaliseYear(Number(m[4])) : null;
        if (m[4] && year === null) return null;
        const probeYear = year ?? 2026; // leap-year agnostic day validation
        if (!isValidYmd(probeYear, month, day)) return null;
        if (m[3]) {
          const secondDay = Number(m[3]);
          if (!isValidYmd(probeYear, month, secondDay)) return null;
        }

        const separator = m[0].includes("/") ? "/" : m[0].includes(".") ? "." : "-";
        // Hyphenated number pairs without a year ("1-4", "10-12") are ranges in prose, never dates.
        if (separator === "-" && !m[4]) {
          return null;
        }
        // "Weeks 2-3", "Chapters 4-5", "pages 12-15", "Episodes 1-4" are ranges, not dates.
        // Slash formats ("9/12") are almost always dates, so only guard the rest.
        if (separator !== "/") {
          const before = text.slice(Math.max(0, m.index - 24), m.index);
          if (
            /\b(week|wk|weeks|chapter|chapters|ch|module|modules|unit|units|page|pages|pp|part|sections?|lecture|lectures|class|classes|day|days|hour|hours|hrs?|credits?|points?|pts|score|grades?|weight|version|v|figure|table|slide|exercises?|problems?|questions?|items?|nos?|episodes?|eps?)\b[\s.]*$/i.test(
              before,
            )
          ) {
            return null;
          }
        }
        if (/^\s*(weeks?|chapters?|pages?|hours?|days?|credits?|pts?|points?|%)/i.test(text.slice(m.index + m[0].length))) {
          return null;
        }
        return { year, month, day, raw: m[0], numeric: true };
      },
    },
    {
      // September 3rd, 2026  |  Sept. 3  |  Sep 1 & 3  |  Oct 6 - 8  |  Sep 1/3
      regex: new RegExp(
        String.raw`\b${MONTH_WORD}\.?\s+(\d{1,2})${ORDINAL}(?:\s*(?:&|and|to|through|thru|[-–—/])\s*(\d{1,2})${ORDINAL})?(?:\s*,?\s*(\d{4}))?`,
        "gi",
      ),
      build: (m) => {
        const month = monthFromWord(m[1]);
        const day = Number(m[2]);
        const year = m[4] ? normaliseYear(Number(m[4])) : null;
        if (!month || !isValidYmd(year ?? 2026, month, day)) return null;
        if (m[3]) {
          const secondDay = Number(m[3]);
          if (!isValidYmd(year ?? 2026, month, secondDay)) return null;
        }
        return { year, month, day, raw: m[0], numeric: false };
      },
    },
    {
      // 3 September 2026  |  3rd of Sept  |  1 & 3 September  |  15-Sep-2026
      regex: new RegExp(
        String.raw`\b(\d{1,2})${ORDINAL}(?:\s*(?:&|and|to|through|thru|[-–—/])\s*(\d{1,2})${ORDINAL})?[\s\-/]+(?:of\s+)?${MONTH_WORD}\.?(?:[\s\-/]*,?\s*(\d{4}))?`,
        "gi",
      ),
      build: (m) => {
        const day = Number(m[1]);
        const month = monthFromWord(m[3]);
        const year = m[4] ? normaliseYear(Number(m[4])) : null;
        if (!month || !isValidYmd(year ?? 2026, month, day)) return null;
        if (m[2]) {
          const secondDay = Number(m[2]);
          if (!isValidYmd(year ?? 2026, month, secondDay)) return null;
        }
        return { year, month, day, raw: m[0], numeric: false };
      },
    },
  ];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const token = pattern.build(match);
      if (token) push(token, match.index);
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }

  // Drop tokens that overlap a longer one (e.g. the "9/3" inside "9/3/2026").
  tokens.sort((a, b) => a.index - b.index || b.raw.length - a.raw.length);
  const kept: DateToken[] = [];
  for (const token of tokens) {
    const overlaps = kept.some(
      (other) =>
        token.index < other.index + other.raw.length &&
        other.index < token.index + token.raw.length,
    );
    if (!overlaps) kept.push(token);
  }

  return kept.sort((a, b) => a.index - b.index);
}

/** Finds a clock time such as `11:59 PM`, `23:59`, `midnight`, `noon` or `9 am`. */
export function findTimeToken(text: string): TimeToken | null {
  const midnight = /\b(?:at\s+|by\s+)?midnight\b/i.exec(text);
  if (midnight) {
    return {
      time: "23:59",
      raw: midnight[0],
      index: midnight.index,
    };
  }

  const noon = /\b(?:at\s+|by\s+)?noon\b/i.exec(text);
  if (noon) {
    return {
      time: "12:00",
      raw: noon[0],
      index: noon.index,
    };
  }

  const withMeridiem = /\b(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s?m\.?|([ap])\b)/i.exec(text);
  if (withMeridiem) {
    let hour = Number(withMeridiem[1]);
    const minute = Number(withMeridiem[2] ?? 0);
    const meridiem = (withMeridiem[3] ?? withMeridiem[4]).toLowerCase();
    const isPm = meridiem === "p";
    if (hour <= 12 && minute < 60) {
      if (isPm && hour !== 12) hour += 12;
      if (!isPm && hour === 12) hour = 0;
      return {
        time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        raw: withMeridiem[0],
        index: withMeridiem.index,
      };
    }
  }

  const twentyFour = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (twentyFour) {
    return {
      time: `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}`,
      raw: twentyFour[0],
      index: twentyFour.index,
    };
  }

  return null;
}

/** Finds a `Week 3` / `wk 12` marker. */
export function findWeekToken(text: string): { week: number; index: number } | null {
  const match = /\b(?:week|wk)\.?\s*(\d{1,2})\b/i.exec(text);
  if (!match) return null;
  const week = Number(match[1]);
  if (week < 1 || week > 30) return null;
  return { week, index: match.index };
}

export type YearContext = {
  /** Year of the term the syllabus belongs to, when known. */
  anchorYear?: number | null;
  /** "Today" in `YYYY-MM-DD`. Defaults to the current date. */
  reference?: string;
};

/**
 * Picks a calendar year for a month/day pair that was written without one.
 * Prefers years inside the plausible term window, then the nearest year.
 */
export function inferYear(month: number, day: number, context: YearContext = {}): number {
  const reference = context.reference
    ? new Date(`${context.reference}T00:00:00Z`)
    : new Date();
  const refYear = reference.getUTCFullYear();

  const candidates = new Set<number>();
  if (context.anchorYear) {
    candidates.add(context.anchorYear);
    candidates.add(context.anchorYear + 1);
  }
  candidates.add(refYear);

  const windowStart = new Date(reference.getTime() - 90 * 86400000);
  const windowEnd = new Date(reference.getTime() + 400 * 86400000);

  const scored = [...candidates].map((year) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    const inWindow = date >= windowStart && date <= windowEnd;
    return { year, date, inWindow };
  });

  const inWindow = scored.filter((entry) => entry.inWindow);
  if (inWindow.length > 0) {
    inWindow.sort((a, b) => a.date.getTime() - b.date.getTime());
    return inWindow[0].year;
  }

  scored.sort(
    (a, b) =>
      Math.abs(a.date.getTime() - reference.getTime()) -
      Math.abs(b.date.getTime() - reference.getTime()),
  );
  return scored[0].year;
}

/** Turns a token into an ISO `YYYY-MM-DD` date. */
export function tokenToIso(token: DateToken, context: YearContext = {}): string {
  const year = token.year ?? inferYear(token.month, token.day, context);
  return `${year}-${String(token.month).padStart(2, "0")}-${String(token.day).padStart(2, "0")}`;
}

/** Guesses the term (`Fall 2026`) mentioned in a syllabus. */
export function findTerm(text: string): { label: string; year: number } | null {
  const match = /\b(fall|spring|summer|winter)\s*(?:semester\s*)?(?:of\s*)?(20\d{2})\b/i.exec(
    text,
  );
  if (match) {
    const label = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}`;
    return { label, year: Number(match[2]) };
  }
  const reverse = /\b(20\d{2})\s*(fall|spring|summer|winter)\b/i.exec(text);
  if (reverse) {
    const label = `${reverse[2][0].toUpperCase()}${reverse[2].slice(1).toLowerCase()} ${reverse[1]}`;
    return { label, year: Number(reverse[1]) };
  }
  return null;
}

const SEASON_START: Record<string, [number, number]> = {
  spring: [1, 10],
  summer: [6, 1],
  fall: [8, 25],
  winter: [12, 1],
};

/** Rough first day of a term, used to resolve `Week N` entries. */
export function guessTermStart(label: string, year: number): string {
  const season = label.split(/\s+/)[0]?.toLowerCase() ?? "fall";
  const [month, day] = SEASON_START[season] ?? SEASON_START.fall;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86400000);
}

const DAY_INDICES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Resolves a named day of the week ("Tuesday", "Sunday") relative to an anchor date.
 * If target is Sunday and anchor is a weekday, resolves to the Sunday ending that week.
 */
export function resolveDayOfWeek(anchorIso: string, dayName: string): string {
  const target = DAY_INDICES[dayName.toLowerCase()];
  if (target === undefined) return anchorIso;
  const [y, m, d] = anchorIso.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  const anchorDay = anchor.getUTCDay();

  let diff = target - anchorDay;
  if (target === 0 && anchorDay > 0) {
    diff = 7 - anchorDay;
  } else if (diff < -1) {
    diff += 7;
  }
  const result = new Date(anchor.getTime() + diff * 86400000);
  const ry = result.getUTCFullYear();
  const rm = String(result.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(result.getUTCDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

