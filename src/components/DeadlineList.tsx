"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EventDialog, type CourseOption } from "@/components/EventDialog";
import { TypeChip } from "@/components/TypeChip";
import { apiFetch } from "@/lib/api";
import { countdownLabel, daysUntil, prettyDate, prettyTime } from "@/lib/format";
import type { CourseEvent } from "@/lib/types";

export type DeadlineListProps = {
  courses: CourseOption[];
  events: CourseEvent[];
  today: string;
  emptyHint?: string;
};

type Group = { key: string; label: string; tone: string; items: CourseEvent[] };

function isApproximate(event: CourseEvent): boolean {
  return event.source === "parsed" && event.confidence < 0.7;
}

export function DeadlineList({ courses, events, today, emptyHint }: DeadlineListProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; event: CourseEvent | null; date?: string }>(
    { open: false, event: null },
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const courseLabel = useMemo(() => {
    const map = new Map(courses.map((course) => [course.id, course.code ?? course.name]));
    return (id: string) => map.get(id) ?? "Course";
  }, [courses]);

  const groups = useMemo<Group[]>(() => {
    const open = events.filter((event) => !event.completed);
    const overdue = open.filter((event) => event.dueDate < today);
    const soon = open.filter((event) => daysUntil(event.dueDate, today) >= 0 && daysUntil(event.dueDate, today) <= 7);
    const later = open.filter((event) => daysUntil(event.dueDate, today) > 7);
    const done = events.filter((event) => event.completed);

    return [
      { key: "overdue", label: "Overdue", tone: "text-rose-300", items: overdue },
      { key: "soon", label: "Next 7 days", tone: "text-amber-300", items: soon },
      { key: "later", label: "Later", tone: "text-muted", items: later },
      { key: "done", label: "Completed", tone: "text-muted", items: done },
    ].filter((group) => group.items.length > 0);
  }, [events, today]);

  async function toggleComplete(event: CourseEvent) {
    setBusyId(event.id);
    try {
      await apiFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        json: { completed: !event.completed },
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(event: CourseEvent) {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    setBusyId(event.id);
    try {
      await apiFetch(`/api/events/${event.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">
        {emptyHint ?? "No deadlines yet. Upload a syllabus to fill the calendar."}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className={`section-title ${group.tone}`}>
            {group.label}
            <span className="ml-2 text-muted/70">{group.items.length}</span>
          </h3>
          <ul className="mt-2 divide-y divide-line/70 overflow-hidden rounded-xl border border-line">
            {group.items.map((event) => (
              <li
                key={event.id}
                className={`flex items-center gap-3 bg-surface/60 px-3 py-2.5 transition-colors hover:bg-surface-2/70 ${
                  busyId === event.id ? "opacity-60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-indigo-500"
                  checked={event.completed}
                  onChange={() => toggleComplete(event)}
                  aria-label={`Mark ${event.title} as ${event.completed ? "unfinished" : "done"}`}
                />

                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setDialog({ open: true, event })}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`truncate text-sm font-medium ${
                        event.completed ? "text-muted line-through" : ""
                      }`}
                    >
                      {event.title}
                    </span>
                    {isApproximate(event) ? (
                      <span
                        className="chip bg-amber-500/15 text-amber-300 ring-amber-500/30"
                        title="Detected automatically — double-check this date"
                      >
                        check date
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted">
                    <span>{courseLabel(event.courseId)}</span>
                    <span aria-hidden="true">•</span>
                    <span>{prettyDate(event.dueDate)}</span>
                    {prettyTime(event.dueTime) ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{prettyTime(event.dueTime)}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">•</span>
                    <span>{countdownLabel(event.dueDate, today)}</span>
                  </span>
                </button>

                <TypeChip type={event.type} className="hidden sm:inline-flex" />

                <button
                  type="button"
                  className="btn-icon"
                  aria-label={`Edit ${event.title}`}
                  onClick={() => setDialog({ open: true, event })}
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                    <path
                      d="M4 20h4l10-10-4-4L4 16v4Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      fill="none"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon hover:text-rose-300"
                  aria-label={`Delete ${event.title}`}
                  onClick={() => remove(event)}
                >
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                    <path
                      d="M5 7h14M9 7V5h6v2m-7 0 1 12h6l1-12"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <EventDialog
        open={dialog.open}
        courses={courses}
        event={dialog.event}
        onClose={() => setDialog({ open: false, event: null })}
      />
    </div>
  );
}
