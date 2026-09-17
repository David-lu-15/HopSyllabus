"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, errorMessage } from "@/lib/api";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type CourseEvent, type EventType } from "@/lib/types";

export type CourseOption = { id: string; name: string; code: string | null };

export type EventDialogProps = {
  open: boolean;
  courses: CourseOption[];
  event?: CourseEvent | null;
  defaultCourseId?: string;
  defaultDate?: string;
  onClose: () => void;
};

const EMPTY_FORM = {
  title: "",
  type: "assignment" as EventType,
  dueDate: "",
  dueTime: "",
  notes: "",
  courseId: "",
};

export function EventDialog({ open, ...props }: EventDialogProps) {
  if (!open) return null;
  // Remounting on open/edit target resets the form without an effect.
  return <EventDialogForm key={props.event?.id ?? `new-${props.defaultDate ?? ""}`} {...props} />;
}

function EventDialogForm({
  courses,
  event = null,
  defaultCourseId,
  defaultDate,
  onClose,
}: Omit<EventDialogProps, "open">) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    event
      ? {
          title: event.title,
          type: event.type,
          dueDate: event.dueDate,
          dueTime: event.dueTime ?? "",
          notes: event.notes ?? "",
          courseId: event.courseId,
        }
      : {
          ...EMPTY_FORM,
          dueDate: defaultDate ?? "",
          courseId: defaultCourseId ?? courses[0]?.id ?? "",
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        dueDate: form.dueDate,
        dueTime: form.dueTime === "" ? null : form.dueTime,
        notes: form.notes.trim() === "" ? null : form.notes.trim(),
      };

      if (event) {
        await apiFetch(`/api/events/${event.id}`, { method: "PATCH", json: payload });
      } else {
        await apiFetch(`/api/courses/${form.courseId}/events`, {
          method: "POST",
          json: { events: [payload] },
        });
      }
      router.refresh();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/events/${event.id}`, { method: "DELETE" });
      router.refresh();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function toggleComplete() {
    if (!event) return;
    setBusy(true);
    try {
      await apiFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        json: { completed: !event.completed },
      });
      router.refresh();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="card mt-[6vh] w-full max-w-lg p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={event ? "Edit deadline" : "Add deadline"}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {event ? "Edit deadline" : "Add a deadline"}
          </h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="field-label" htmlFor="event-title">
              Title
            </label>
            <input
              id="event-title"
              className="field"
              value={form.title}
              placeholder="Problem Set 3"
              onChange={(inputEvent) => setForm({ ...form, title: inputEvent.target.value })}
            />
          </div>

          {!event && courses.length > 1 ? (
            <div>
              <label className="field-label" htmlFor="event-course">
                Course
              </label>
              <select
                id="event-course"
                className="field"
                value={form.courseId}
                onChange={(selectEvent) =>
                  setForm({ ...form, courseId: selectEvent.target.value })
                }
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code ? `${course.code} — ${course.name}` : course.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="event-type">
                Type
              </label>
              <select
                id="event-type"
                className="field"
                value={form.type}
                onChange={(selectEvent) =>
                  setForm({ ...form, type: selectEvent.target.value as EventType })
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="event-time">
                Time (optional)
              </label>
              <input
                id="event-time"
                type="time"
                className="field"
                value={form.dueTime}
                onChange={(inputEvent) => setForm({ ...form, dueTime: inputEvent.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="event-date">
              Due date
            </label>
            <input
              id="event-date"
              type="date"
              className="field"
              value={form.dueDate}
              onChange={(inputEvent) => setForm({ ...form, dueDate: inputEvent.target.value })}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="event-notes">
              Notes
            </label>
            <textarea
              id="event-notes"
              className="field min-h-20 resize-y"
              value={form.notes}
              placeholder="Submit through the course portal"
              onChange={(inputEvent) => setForm({ ...form, notes: inputEvent.target.value })}
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {event ? (
              <>
                <button type="button" className="btn-ghost" onClick={toggleComplete} disabled={busy}>
                  {event.completed ? "Mark unfinished" : "Mark done"}
                </button>
                <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={busy || form.title.trim() === "" || form.dueDate === ""}
            >
              {busy ? "Saving…" : event ? "Save changes" : "Add deadline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
