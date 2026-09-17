import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseSyllabus } from "../src/lib/parse/index";

test("sample-syllabus.txt extracts all 11 expected deadlines", async () => {
  const samplePath = path.join(__dirname, "fixtures", "sample-syllabus.txt");
  const buffer = fs.readFileSync(samplePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "sample-syllabus.txt",
  });

  assert.equal(result.events.length, 11);
  assert.equal(result.course.code, "CS 310");
  assert.equal(result.course.name, "Data Structures and Algorithms");
  assert.equal(result.course.term, "Fall 2026");

  const titles = result.events.map((e) => e.title);
  assert.ok(titles.some((t) => t.includes("Big-O analysis")));
  assert.ok(titles.some((t) => t.includes("Final Exam")));
});

test("canvas-table-syllabus.txt extracts all 39 expected deadlines", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "canvas-table-syllabus.txt");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "canvas-table-syllabus.txt",
  });

  assert.equal(result.events.length, 39);
  assert.equal(result.course.name, "General Physics Laboratory 2");

  // Verify specific events and properties
  const first = result.events[0];
  assert.equal(first.dueDate, "2026-09-02");
  assert.equal(first.dueTime, "16:30");
  assert.equal(first.type, "assignment");
  assert.equal(first.title, "In-Class: Digital Multimeter Measurement Introduction");

  const quiz = result.events.find((e) => e.title.includes("Distance Dependence of Radiation") && e.type === "quiz");
  assert.ok(quiz);
  assert.equal(quiz.dueDate, "2026-09-16");
  assert.equal(quiz.dueTime, "13:30");

  const proposal = result.events.find((e) => e.title.includes("Project Proposal"));
  assert.ok(proposal);
  assert.equal(proposal.dueDate, "2026-10-30");
  assert.equal(proposal.type, "project");

  const poster = result.events.find((e) => e.title.includes("Poster Session"));
  assert.ok(poster);
  assert.equal(poster.dueDate, "2026-12-07");
  assert.equal(poster.type, "project");

  const lastDay = result.events.find((e) => e.title.includes("Last Day to Submit Anything"));
  assert.ok(lastDay);
  assert.equal(lastDay.dueDate, "2026-12-16");
});
