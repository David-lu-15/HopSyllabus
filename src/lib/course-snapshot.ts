import type { Course, CourseEvent } from "./types";

export const COURSE_SNAPSHOT_COOKIE = "hopsyllabus-course-snapshot";

export type CourseSnapshot = {
  course: Course;
  events: CourseEvent[];
};

export function encodeCourseSnapshot(snapshot: CourseSnapshot): string {
  return Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64url");
}

export function decodeCourseSnapshot(value: string | undefined): CourseSnapshot | null {
  if (!value) return null;

  try {
    const snapshot = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CourseSnapshot;
    if (!snapshot.course?.id || !Array.isArray(snapshot.events)) return null;
    return snapshot;
  } catch {
    return null;
  }
}