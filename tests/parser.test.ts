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

test("pwe-syllabus.txt extracts all 40 events including multiple readings per day and resolves weekdays correctly", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "pwe-syllabus.txt");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "pwe-syllabus.txt",
  });

  assert.equal(result.course.name, "Professional Writing and Ethics");
  assert.equal(result.course.instructor, "Dr. Cara Dickason");
  assert.equal(result.course.term, "Fall 2026");
  assert.equal(result.events.length, 40);

  // Weekly reading assignment test
  const shittyDrafts = result.events.find((e) => e.title.includes("Shitty First Drafts"));
  assert.ok(shittyDrafts);
  assert.equal(shittyDrafts.dueDate, "2026-09-03");
  assert.equal(shittyDrafts.type, "assignment");

  // Multiple readings due on Tuesday Sep 8
  const sep8Events = result.events.filter((e) => e.dueDate === "2026-09-08");
  assert.equal(sep8Events.length, 2);
  assert.ok(sep8Events.some((e) => e.title.includes("How Should Engineers Think About Ethics")));
  assert.ok(sep8Events.some((e) => e.title.includes("Nyholm")));

  // Multiple readings due on Thursday Sep 10
  const sep10Events = result.events.filter((e) => e.dueDate === "2026-09-10");
  assert.equal(sep10Events.length, 2);
  assert.ok(sep10Events.some((e) => e.title.includes("Big Brother Watching Us")));
  assert.ok(sep10Events.some((e) => e.title.includes("Washington Post")));

  // Multiple readings due on Tuesday Sep 15
  const sep15Events = result.events.filter((e) => e.dueDate === "2026-09-15");
  assert.equal(sep15Events.length, 3);
  assert.ok(sep15Events.some((e) => e.title.includes("Rabbit Hole")));
  assert.ok(sep15Events.some((e) => e.title.includes("AI training data set")));
  assert.ok(sep15Events.some((e) => e.title.includes("AI Copyright Battle")));

  // Multiple readings due on Thursday Sep 17
  const sep17Events = result.events.filter((e) => e.dueDate === "2026-09-17");
  assert.equal(sep17Events.length, 2);
  assert.ok(sep17Events.some((e) => e.title.includes("Free Online Services")));
  assert.ok(sep17Events.some((e) => e.title.includes("Bespoke Pricing")));

  // Multiple assignments due on Tuesday Sep 22
  const sep22Events = result.events.filter((e) => e.dueDate === "2026-09-22");
  assert.equal(sep22Events.length, 2);
  assert.ok(sep22Events.some((e) => e.title.includes("annotation")));
  assert.ok(sep22Events.some((e) => e.title.includes("Birkenstein")));

  // Multiple assignments due on Thursday Sep 24
  const sep24Events = result.events.filter((e) => e.dueDate === "2026-09-24");
  assert.equal(sep24Events.length, 2);
  assert.ok(sep24Events.some((e) => e.title.includes("annotations")));
  assert.ok(sep24Events.some((e) => e.title.includes("Art of Summarizing")));

  // Multiple assignments due on Tuesday Oct 20
  const oct20Events = result.events.filter((e) => e.dueDate === "2026-10-20");
  assert.equal(oct20Events.length, 3);
  assert.ok(oct20Events.some((e) => e.title.includes("Parents are desperate")));
  assert.ok(oct20Events.some((e) => e.title.includes("We Kill People Based on Metadata")));
  assert.ok(oct20Events.some((e) => e.title.includes("Policy Briefs writing resource")));

  // Multiple podcasts on Thursday Nov 12
  const nov12Events = result.events.filter((e) => e.dueDate === "2026-11-12");
  assert.equal(nov12Events.length, 2);
  assert.ok(nov12Events.some((e) => e.title.includes("Hard Fork")));
  assert.ok(nov12Events.some((e) => e.title.includes("Reply all")));

  // Sunday deadlines resolved relative to weekly date ranges
  const issueDraft = result.events.find((e) => e.title.toLowerCase().includes("issue brief draft"));
  assert.ok(issueDraft);
  assert.equal(issueDraft.dueDate, "2026-10-04");
  assert.equal(issueDraft.dueTime, "12:00");

  const revIssue = result.events.find((e) => e.title.toLowerCase().includes("revised issue brief"));
  assert.ok(revIssue);
  assert.equal(revIssue.dueDate, "2026-10-11");
  assert.equal(revIssue.dueTime, "12:00");

  const policyDraft = result.events.find((e) => e.title.toLowerCase().includes("policy brief draft"));
  assert.ok(policyDraft);
  assert.equal(policyDraft.dueDate, "2026-11-08");
  assert.equal(policyDraft.dueTime, "12:00");

  const revPolicy = result.events.find((e) => e.title.toLowerCase().includes("revised policy brief"));
  assert.ok(revPolicy);
  assert.equal(revPolicy.dueDate, "2026-11-15");
  assert.equal(revPolicy.dueTime, "22:00");

  const projDraft = result.events.find((e) => e.title.toLowerCase().includes("project draft"));
  assert.ok(projDraft);
  assert.equal(projDraft.dueDate, "2026-11-29");
  assert.equal(projDraft.dueTime, "12:00");

  const revProj = result.events.find((e) => e.title.toLowerCase().includes("revised project"));
  assert.ok(revProj);
  assert.equal(revProj.dueDate, "2026-12-06");
  assert.equal(revProj.dueTime, "22:00");

  // Tuesday deadlines resolved relative to weekly date ranges
  const peerFeedbacks = result.events.filter((e) => e.title.toLowerCase().includes("peer feedback"));
  assert.equal(peerFeedbacks.length, 3);
  assert.deepEqual(
    peerFeedbacks.map((e) => ({ date: e.dueDate, time: e.dueTime })),
    [
      { date: "2026-10-06", time: "10:00" },
      { date: "2026-11-10", time: "10:00" },
      { date: "2026-12-01", time: "10:00" },
    ],
  );

  const memo = result.events.find((e) => e.title.toLowerCase().includes("group memo"));
  assert.ok(memo);
  assert.equal(memo.dueDate, "2026-10-27");

  const proposal = result.events.find((e) => e.title.toLowerCase() === "proposal");
  assert.ok(proposal);
  assert.equal(proposal.dueDate, "2026-11-17");

  // Thursday deadline resolved relative to weekly date ranges
  const thursPres = result.events.find((e) => e.dueDate === "2026-10-15");
  assert.ok(thursPres);
  assert.ok(thursPres.title.toLowerCase().includes("presentations"));

  // Final reflection
  const reflection = result.events.find((e) => e.title.toLowerCase().includes("final reflection"));
  assert.ok(reflection);
  assert.equal(reflection.dueDate, "2026-12-08");
});

test("markdown-syllabus.md extracts deadlines with checkboxes, bold dates, midnight, and noon", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "markdown-syllabus.md");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "markdown-syllabus.md",
  });

  assert.equal(result.course.code, "CS 421");
  assert.equal(result.course.name, "Modern Software Systems");
  assert.equal(result.events.length, 7);

  // Homework 1 with midnight -> 23:59
  const hw1 = result.events.find((e) => e.title.includes("Homework 1"));
  assert.ok(hw1);
  assert.equal(hw1.dueDate, "2026-09-18");
  assert.equal(hw1.dueTime, "23:59");
  assert.equal(hw1.title, "Homework 1: Container Orchestration");

  // Homework 2 with 11:59pm
  const hw2 = result.events.find((e) => e.title.includes("Homework 2"));
  assert.ok(hw2);
  assert.equal(hw2.dueDate, "2026-10-02");
  assert.equal(hw2.dueTime, "23:59");
  assert.equal(hw2.title, "Homework 2: Distributed Consensus");

  // Project proposal with markdown link and noon -> 12:00
  const proposal = result.events.find((e) => e.title.includes("Project Proposal"));
  assert.ok(proposal);
  assert.equal(proposal.dueDate, "2026-10-16");
  assert.equal(proposal.dueTime, "12:00");
  assert.equal(proposal.title, "Project Proposal");

  // Midterm Exam
  const exam = result.events.find((e) => e.title.includes("Midterm Exam"));
  assert.ok(exam);
  assert.equal(exam.dueDate, "2026-10-23");
  assert.equal(exam.type, "test");

  // Homework 3 with @ 11:59p
  const hw3 = result.events.find((e) => e.title.includes("Homework 3"));
  assert.ok(hw3);
  assert.equal(hw3.dueDate, "2026-11-06");
  assert.equal(hw3.dueTime, "23:59");

  // Milestone
  const milestone = result.events.find((e) => e.title.includes("Project Milestone"));
  assert.ok(milestone);
  assert.equal(milestone.dueDate, "2026-11-20");
  assert.equal(milestone.dueTime, "23:59");

  // Final Project Report
  const finalReport = result.events.find((e) => e.title.includes("Final Project Report"));
  assert.ok(finalReport);
  assert.equal(finalReport.dueDate, "2026-12-11");
  assert.equal(finalReport.dueTime, "23:59");
});

test("unconventional-syllabus.txt extracts deadlines with international dates and shorthand times", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "unconventional-syllabus.txt");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "unconventional-syllabus.txt",
  });

  assert.equal(result.course.name, "Comparative Political Economy");
  assert.ok(result.events.length >= 8);

  // Policy Memo 1 with @ 5p
  const memo1 = result.events.find((e) => e.title.includes("Policy Memo 1"));
  assert.ok(memo1);
  assert.equal(memo1.dueDate, "2026-09-22");
  assert.equal(memo1.dueTime, "17:00");

  // Midterm Exam with 15 October 2026
  const midterm = result.events.find((e) => e.title.includes("Midterm Exam"));
  assert.ok(midterm);
  assert.equal(midterm.dueDate, "2026-10-15");
  assert.equal(midterm.type, "test");

  // Research Outline with noon
  const outline = result.events.find((e) => e.title.includes("Research Outline"));
  assert.ok(outline);
  assert.equal(outline.dueDate, "2026-10-22");
  assert.equal(outline.dueTime, "12:00");

  // Presentation slides with 3rd of December 2026
  const slides = result.events.find((e) => e.title.includes("Presentation Slides"));
  assert.ok(slides);
  assert.equal(slides.dueDate, "2026-12-03");
  assert.equal(slides.dueTime, "17:00");
});

test("stem-lab-syllabus.txt extracts lab reports, quizzes, problem sets and exam while ignoring optional review", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "stem-lab-syllabus.txt");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "stem-lab-syllabus.txt",
  });

  assert.equal(result.course.code, "CHEM 204");
  assert.equal(result.course.name, "Organic Chemistry Laboratory II");
  assert.equal(result.course.instructor, "Dr. Arthur Pendelton");
  assert.equal(result.events.length, 12);

  // Pre-Lab Quizzes
  const quizzes = result.events.filter((e) => e.type === "quiz");
  assert.equal(quizzes.length, 4);
  assert.equal(quizzes[0].title, "Pre-Lab Quiz #1");
  assert.equal(quizzes[0].dueDate, "2026-09-07");
  assert.equal(quizzes[0].dueTime, "08:00");

  assert.equal(quizzes[1].title, "Pre-Lab Quiz #2");
  assert.equal(quizzes[1].dueDate, "2026-09-14");
  assert.equal(quizzes[1].dueTime, "08:00");

  assert.equal(quizzes[2].title, "Pre-Lab Quiz #3");
  assert.equal(quizzes[2].dueDate, "2026-10-05");
  assert.equal(quizzes[2].dueTime, "08:00");

  assert.equal(quizzes[3].title, "Pre-Lab Quiz #4");
  assert.equal(quizzes[3].dueDate, "2026-10-26");
  assert.equal(quizzes[3].dueTime, "08:00");

  // Lab Reports
  const reports = result.events.filter((e) => e.title.includes("Lab Report"));
  assert.equal(reports.length, 4);
  assert.equal(reports[0].title, "Lab Report #1");
  assert.equal(reports[0].dueDate, "2026-09-11");
  assert.equal(reports[0].dueTime, "17:00");

  assert.equal(reports[1].title, "Lab Report #2");
  assert.equal(reports[1].dueDate, "2026-09-18");
  assert.equal(reports[1].dueTime, "17:00");

  assert.equal(reports[2].title, "Lab Report #3");
  assert.equal(reports[2].dueDate, "2026-10-09");
  assert.equal(reports[2].dueTime, "17:00");

  assert.equal(reports[3].title, "Lab Report #4");
  assert.equal(reports[3].dueDate, "2026-10-30");
  assert.equal(reports[3].dueTime, "17:00");

  // Problem Sets
  const psets = result.events.filter((e) => e.title.includes("Problem Set"));
  assert.equal(psets.length, 3);
  assert.equal(psets[0].title, "Problem Set #1");
  assert.equal(psets[0].dueDate, "2026-09-16");
  assert.equal(psets[0].dueTime, "23:59");

  assert.equal(psets[1].title, "Problem Set #2");
  assert.equal(psets[1].dueDate, "2026-10-29");
  assert.equal(psets[1].dueTime, "23:59");

  assert.equal(psets[2].title, "Final Problem Set #3");
  assert.equal(psets[2].dueDate, "2026-12-07");
  assert.equal(psets[2].dueTime, "23:59");
  assert.equal(psets[2].type, "assignment");

  // Final Exam
  const exam = result.events.find((e) => e.title === "Final Lab Exam");
  assert.ok(exam);
  assert.equal(exam.dueDate, "2026-12-04");
  assert.equal(exam.dueTime, "09:00");
  assert.equal(exam.type, "test");

  // Optional Review Session must NOT be an event
  assert.ok(!result.events.some((e) => e.title.toLowerCase().includes("review")));
});

test("seminar-modular-syllabus.md splits semicolon rows and extracts all deliverables", async () => {
  const fixturePath = path.join(__dirname, "fixtures", "seminar-modular-syllabus.md");
  const buffer = fs.readFileSync(fixturePath);
  const result = await parseSyllabus({
    buffer,
    fileName: "seminar-modular-syllabus.md",
  });

  assert.equal(result.course.code, "HIST 315");
  assert.equal(result.course.name, "The French Revolution & Modernity");
  assert.equal(result.course.instructor, "Dr. Genevieve Moreau");
  assert.equal(result.events.length, 8);

  // Module 1 semicolon-separated deliverables
  const agreement = result.events.find((e) => e.title === "Syllabus Agreement");
  assert.ok(agreement);
  assert.equal(agreement.dueDate, "2026-09-02");
  assert.equal(agreement.dueTime, "23:59");

  const diagEssay = result.events.find((e) => e.title === "Diagnostic Essay");
  assert.ok(diagEssay);
  assert.equal(diagEssay.dueDate, "2026-09-04");
  assert.equal(diagEssay.dueTime, "17:00");

  // Primary Source Analyses
  const analyses = result.events.filter((e) => e.title.includes("Primary Source Analysis"));
  assert.equal(analyses.length, 3);
  assert.equal(analyses[0].title, "Primary Source Analysis #1");
  assert.equal(analyses[0].dueDate, "2026-09-21");

  assert.equal(analyses[1].title, "Primary Source Analysis #2");
  assert.equal(analyses[1].dueDate, "2026-10-12");
  assert.equal(analyses[1].dueTime, "12:00");

  assert.equal(analyses[2].title, "Primary Source Analysis #3");
  assert.equal(analyses[2].dueDate, "2026-11-16");

  // Midterm Essay
  const midterm = result.events.find((e) => e.title === "Midterm Essay");
  assert.ok(midterm);
  assert.equal(midterm.dueDate, "2026-10-26");
  assert.equal(midterm.dueTime, "23:59");
  assert.equal(midterm.type, "test");

  // Research Paper Draft
  const draft = result.events.find((e) => e.title.includes("Research Paper Draft"));
  assert.ok(draft);
  assert.equal(draft.dueDate, "2026-11-30");
  assert.equal(draft.dueTime, "17:00");

  // Research Paper Final Submission
  const finalPaper = result.events.find((e) => e.title === "Research Paper Final Submission");
  assert.ok(finalPaper);
  assert.equal(finalPaper.dueDate, "2026-12-14");
  assert.equal(finalPaper.dueTime, "23:59");
});


