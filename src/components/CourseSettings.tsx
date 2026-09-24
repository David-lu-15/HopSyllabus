"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, errorMessage } from "@/lib/api";
import { COURSE_COLORS, type Course } from "@/lib/types";

export function CourseSettings({ course, syllabi }: { course: Course; syllabi: { id: string; filename: string; uploadedAt: string; sizeBytes: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: course.name,
    code: course.code ?? "",
    term: course.term ?? "",
    instructor: course.instructor ?? "",
    startDate: course.startDate ?? "",
    endDate: course.endDate ?? "",
    color: course.color,
  });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        json: {
          name: form.name.trim(),
          code: form.code.trim() || null,
          term: form.term.trim() || null,
          instructor: form.instructor.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          color: form.color,
        },
      });
      router.refresh();
      setOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function removeCourse() {
    if (
      !window.confirm(
        `Delete “${course.name}” and all of its deadlines? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/courses/${course.id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Course settings</h2>
        <div className="flex gap-2">
          <a className="btn-ghost py-1.5 text-xs" href={`/api/courses/${course.id}/calendar.ics`}>
            Export .ics
          </a>
          <button
            type="button"
            className="btn-danger py-1.5 text-xs"
            onClick={removeCourse}
            disabled={busy}
          >
            Remove course
          </button>
          <button
            type="button"
            className="btn-ghost py-1.5 text-xs"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Edit details"}
          </button>
          <button
            type="button"
            className="btn-ghost py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
            onClick={removeCourse}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>

      {syllabi.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs text-muted">
          {syllabi.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3">
              <span className="truncate">📄 {file.filename}</span>
              <span className="shrink-0">
                {new Date(file.uploadedAt).toLocaleDateString()} ·{" "}
                {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-line/70 pt-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="settings-name">
              Course name
            </label>
            <input
              id="settings-name"
              className="field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-code">
              Code
            </label>
            <input
              id="settings-code"
              className="field"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-term">
              Term
            </label>
            <input
              id="settings-term"
              className="field"
              value={form.term}
              onChange={(event) => setForm({ ...form, term: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="settings-instructor">
              Instructor
            </label>
            <input
              id="settings-instructor"
              className="field"
              value={form.instructor}
              onChange={(event) => setForm({ ...form, instructor: event.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-start">
              Term starts
            </label>
            <input
              id="settings-start"
              type="date"
              className="field"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="settings-end">
              Term ends
            </label>
            <input
              id="settings-end"
              type="date"
              className="field"
              value={form.endDate}
              onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <span className="field-label">Colour</span>
            <div className="flex gap-2">
              {COURSE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use colour ${color}`}
                  onClick={() => setForm({ ...form, color })}
                  className={`size-7 rounded-lg border-2 ${
                    form.color === color ? "border-ink" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}

          <div className="flex flex-wrap justify-between gap-2 sm:col-span-2">
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={busy || form.name.trim() === ""}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
