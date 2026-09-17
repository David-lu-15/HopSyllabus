import { z } from "zod";

import { EVENT_TYPES } from "./types";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.");

export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour HH:MM format.");

export const courseCreateSchema = z.object({
  name: z.string().trim().min(1, "A course name is required.").max(140),
  code: z.string().trim().max(40).nullish(),
  instructor: z.string().trim().max(140).nullish(),
  term: z.string().trim().max(80).nullish(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6366f1.")
    .nullish(),
  startDate: isoDateSchema.nullish(),
  endDate: isoDateSchema.nullish(),
});

export const coursePatchSchema = courseCreateSchema.partial();

export const eventSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  type: z.enum(EVENT_TYPES),
  dueDate: isoDateSchema,
  dueTime: clockTimeSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export const eventPatchSchema = eventSchema.partial().extend({
  completed: z.boolean().optional(),
});

export const importSchema = z.object({
  uploadId: z.string().trim().min(1).nullish(),
  events: z
    .array(
      eventSchema.extend({
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .max(500),
  course: coursePatchSchema.optional(),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That request could not be understood.";
}
