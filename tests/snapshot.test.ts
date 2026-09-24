import assert from "node:assert/strict";
import test from "node:test";

import { decodeCourseSnapshot, encodeCourseSnapshot, syncSnapshotToDb } from "../src/lib/course-snapshot";
import { getCourse, listEvents } from "../src/lib/repo";
import type { Course, CourseEvent } from "../src/lib/types";

test("encodeCourseSnapshot keeps size strictly under 3700 bytes and round-trips accurately", () => {
  const course: Course = {
    id: "c-test-snapshot-1",
    name: "Software Engineering & Systems",
    code: "EN.601.421",
    instructor: "Dr. Ali Madooei",
    term: "Fall 2026",
    color: "#6366f1",
    startDate: "2026-08-31",
    endDate: "2026-12-14",
    createdAt: new Date().toISOString(),
  };

  const events: CourseEvent[] = Array.from({ length: 45 }, (_, i) => ({
    id: `e-${i}`,
    courseId: course.id,
    title: `Homework Assignment #${i + 1}: Implementation and Verification of Critical Features`,
    type: "assignment" as const,
    dueDate: "2026-10-15",
    dueTime: "23:59",
    notes: null,
    confidence: 0.95,
    source: "parsed" as const,
    completed: false,
    createdAt: course.createdAt,
  }));

  const encoded = encodeCourseSnapshot({ course, events });
  assert.ok(encoded.length < 3700, `Encoded size ${encoded.length} should be under 3700 bytes`);

  const decoded = decodeCourseSnapshot(encoded);
  assert.ok(decoded);
  assert.equal(decoded.course.id, course.id);
  assert.equal(decoded.course.name, course.name);
  assert.equal(decoded.course.code, course.code);
  assert.ok(decoded.events.length > 0);
  assert.equal(decoded.events[0].title, events[0].title);
  assert.equal(decoded.events[0].dueDate, events[0].dueDate);
});

test("syncSnapshotToDb restores course and events into SQLite if missing", () => {
  const course: Course = {
    id: "c-test-restore-99",
    name: "Microbiology Laboratory",
    code: "BIO 210",
    instructor: "Dr. Rachel Green",
    term: "Fall 2026",
    color: "#10b981",
    startDate: "2026-09-01",
    endDate: "2026-12-10",
    createdAt: new Date().toISOString(),
  };

  const events: CourseEvent[] = [
    {
      id: "e-restored-1",
      courseId: course.id,
      title: "Lab Report 1: Bacterial Staining",
      type: "assignment",
      dueDate: "2026-09-15",
      dueTime: "17:00",
      notes: null,
      confidence: 1,
      source: "parsed",
      completed: false,
      createdAt: course.createdAt,
    },
    {
      id: "e-restored-2",
      courseId: course.id,
      title: "Midterm Practicum",
      type: "test",
      dueDate: "2026-10-20",
      dueTime: "10:00",
      notes: null,
      confidence: 1,
      source: "parsed",
      completed: false,
      createdAt: course.createdAt,
    },
  ];

  const encoded = encodeCourseSnapshot({ course, events });

  // Initially course does not exist in DB
  assert.equal(getCourse(course.id), null);

  // Sync snapshot
  const synced = syncSnapshotToDb(encoded);
  assert.ok(synced);

  // Now course and events must exist in SQLite
  const restoredCourse = getCourse(course.id);
  assert.ok(restoredCourse);
  assert.equal(restoredCourse.name, "Microbiology Laboratory");
  assert.equal(restoredCourse.code, "BIO 210");

  const restoredEvents = listEvents(course.id);
  assert.equal(restoredEvents.length, 2);
  assert.equal(restoredEvents[0].title, "Lab Report 1: Bacterial Staining");
  assert.equal(restoredEvents[1].title, "Midterm Practicum");
});
