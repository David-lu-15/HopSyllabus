import { NextResponse } from "next/server";

import { storageBackend } from "@/lib/db";
import { listCourses } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports which storage backend this instance is using and how many courses it
 * can see.
 *
 * A deployment runs several instances, so requesting this more than once shows
 * whether they agree. Instances reporting `"backend": "sqlite"` on Vercel are
 * using a private temporary file, which is why a course saved by one request can
 * be missing from the next one.
 */
export async function GET() {
  const backend = storageBackend();
  const shared = backend === "postgres";

  try {
    const courses = await listCourses();
    return NextResponse.json({ backend, shared, courses: courses.length });
  } catch (error) {
    return NextResponse.json(
      {
        backend,
        shared,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
