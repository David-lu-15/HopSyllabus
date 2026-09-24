"use client";

import { useMemo, useState } from "react";

import { EventDialog, type CourseOption } from "@/components/EventDialog";
import { TypeChip, TypeDot } from "@/components/TypeChip";
import {
  WEEKDAYS,
  addMonths,
  buildMonthGrid,
  countdownLabel,
  groupByDate,
  monthLabel,
  prettyTime,
  shortDate,
  toDate,
} from "@/lib/format";
import { EVENT_TYPES, type CourseEvent, type EventType } from "@/lib/types";

export type CalendarCourse = CourseOption & { color: string };

export type CalendarBoardProps = {
  courses: CalendarCourse[];
  events: CourseEvent[];
  /** Server-provided "today" so client and server render identically. */
  today: string;
  showCourseFilter?: boolean;
  initialDate?: string;
};

export function CalendarBoard({
  courses,
  events,
  today,
  showCourseFilter = true,
  initialDate,
}: CalendarBoardProps) {
  const initial = initialDate ? toDate(initialDate) : toDate(today);
  const [cursor, setCursor] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(initialDate ?? today);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [hiddenTypes, setHiddenTypes] = useState<EventType[]>([]);
  const [dialog, setDialog] = useState<{
    open: boolean;
    event: CourseEvent | null;
    date?: string;
  }>({ open: false, event: null });

  const colorByCourse = useMemo(
    () => new Map(courses.map((course) => [course.id, course.color])),
    [courses],
  );

  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          (courseFilter === "all" || event.courseId === courseFilter) &&
          !hiddenTypes.includes(event.type),
      ),
    [events, courseFilter, hiddenTypes],
  );

  const byDate = useMemo(() => groupByDate(visibleEvents), [visibleEvents]);
  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, today),
    [cursor, today],
  );

  const selectedEvents = selected ? byDate.get(selected) ?? [] : [];
  const upcoming = visibleEvents
    .filter((event) => !event.completed && event.dueDate >= today)
    .slice(0, 6);
  const monthCount = visibleEvents.filter((event) => {
    const date = toDate(event.dueDate);
    return date.getFullYear() === cursor.year && date.getMonth() === cursor.month;
  }).length;

  function toggleType(type: EventType) {
    setHiddenTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-icon"
            aria-label="Previous month"
            onClick={() => setCursor(addMonths(cursor.year, cursor.month, -1))}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label="Next month"
            onClick={() => setCursor(addMonths(cursor.year, cursor.month, 1))}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="ml-1 text-base font-semibold">{monthLabel(cursor.year, cursor.month)}</h2>
          <span className="text-xs text-muted">{monthCount} deadlines</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost py-1.5 text-xs"
            onClick={() => {
              const now = toDate(today);
              setCursor({ year: now.getFullYear(), month: now.getMonth() });
              setSelected(today);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-primary py-1.5 text-xs"
            onClick={() => setDialog({ open: true, event: null, date: selected ?? today })}
          >
            + Add deadline
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {showCourseFilter ? (
          <div className="mr-1 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCourseFilter("all")}
              className={`chip ${
                courseFilter === "all"
                  ? "bg-brand/20 text-brand-soft ring-brand/40"
                  : "bg-surface-2/60 text-muted ring-line"
              }`}
            >
              All courses
            </button>
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setCourseFilter(course.id)}
                className={`chip ${
                  courseFilter === course.id
                    ? "bg-surface-3 text-ink ring-line"
                    : "bg-surface-2/60 text-muted ring-line"
                }`}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: course.color }}
                  aria-hidden="true"
                />
                {course.code ?? course.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3">
        <span className="mr-1 text-xs text-muted">Show types:</span>
        {EVENT_TYPES.map((type) => (
          <button key={type} type="button" onClick={() => toggleType(type)} className="opacity-100">
            <TypeChip
              type={type}
              className={
                hiddenTypes.includes(type)
                  ? "bg-surface-2/40 text-muted/60 ring-line line-through"
                  : ""
              }
            />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/50 text-center text-[0.7rem] font-medium tracking-wide text-muted uppercase">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const dayEvents = byDate.get(cell.iso) ?? [];
              const isSelected = cell.iso === selected;
              return (
                <div
                  key={cell.iso}
                  className={`min-h-24 border-r border-b border-line/70 p-1.5 last:border-r-0 ${
                    cell.inMonth ? "" : "bg-surface-2/20"
                  } ${isSelected ? "ring-1 ring-brand/60 ring-inset" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(cell.iso)}
                    className={`mb-1 flex w-full items-center justify-between rounded-md px-1 py-0.5 text-xs ${
                      cell.isToday
                        ? "bg-brand font-semibold text-white"
                        : cell.inMonth
                          ? "text-muted hover:text-ink"
                          : "text-muted/50 hover:text-muted"
                    }`}
                  >
                    <span>{cell.day}</span>
                    {dayEvents.length > 0 ? (
                      <span className={cell.isToday ? "text-white/80" : "text-muted/70"}>
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </button>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setDialog({ open: true, event })}
                        className={`flex w-full items-center gap-1.5 rounded-md border-l-2 bg-surface-2/70 px-1.5 py-1 text-left text-[0.7rem] leading-tight transition-colors hover:bg-surface-3 ${
                          event.completed ? "opacity-45 line-through" : ""
                        }`}
                        style={{ borderLeftColor: colorByCourse.get(event.courseId) ?? "#6366f1" }}
                        title={event.title}
                      >
                        <TypeDot type={event.type} />
                        <span className="truncate">{event.title}</span>
                      </button>
                    ))}
                    {dayEvents.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => setSelected(cell.iso)}
                        className="w-full rounded-md px-1.5 text-left text-[0.7rem] text-muted hover:text-ink"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <h3 className="text-sm font-semibold">
              {selected ? shortDate(selected) : "Pick a day"}
              {selected ? (
                <span className="ml-2 text-xs font-normal text-muted">
                  {countdownLabel(selected, today)}
                </span>
              ) : null}
            </h3>

            <div className="mt-3 space-y-2">
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-muted">Nothing due on this day.</p>
              ) : (
                selectedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setDialog({ open: true, event })}
                    className="w-full rounded-lg border border-line bg-surface/70 p-2.5 text-left transition-colors hover:border-brand/50"
                  >
                    <span className="flex items-center gap-2">
                      <TypeDot type={event.type} />
                      <span
                        className={`truncate text-sm font-medium ${event.completed ? "line-through opacity-60" : ""}`}
                      >
                        {event.title}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted">
                      <TypeChip type={event.type} className="py-0.5 text-[0.65rem]" />
                      {prettyTime(event.dueTime) ? <span>{prettyTime(event.dueTime)}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <h3 className="text-sm font-semibold">Coming up</h3>
            <ol className="mt-3 space-y-2.5">
              {upcoming.length === 0 ? (
                <li className="text-xs text-muted">No upcoming deadlines.</li>
              ) : (
                upcoming.map((event) => (
                  <li key={event.id} className="flex gap-2.5">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorByCourse.get(event.courseId) ?? "#6366f1" }}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => setDialog({ open: true, event })}
                    >
                      <span className="block truncate text-sm">{event.title}</span>
                      <span className="block text-[0.7rem] text-muted">
                        {shortDate(event.dueDate)} · {countdownLabel(event.dueDate, today)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ol>
          </div>
        </div>
      </div>

      <EventDialog
        open={dialog.open}
        courses={courses}
        event={dialog.event}
        defaultDate={dialog.date}
        defaultCourseId={courseFilter === "all" ? undefined : courseFilter}
        onClose={() => setDialog({ open: false, event: null })}
      />
    </div>
  );
}
