import { NextResponse } from "next/server";

import { COURSE_SNAPSHOT_COOKIE, encodeCourseSnapshot } from "@/lib/course-snapshot";
import { createCourse, listCourseSummaries } from "@/lib/repo";
import { courseCreateSchema, firstIssue } from "@/lib/validate";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ courses: listCourseSummaries() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = courseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const course = createCourse(parsed.data);
  const response = NextResponse.json({ course }, { status: 201 });
  response.cookies.set(
    COURSE_SNAPSHOT_COOKIE,
    encodeCourseSnapshot({ course, events: [] }),
    {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
  return response;
}
