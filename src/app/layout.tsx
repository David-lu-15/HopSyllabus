import type { Metadata } from "next";
import { Source_Serif_4, Work_Sans } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HopSyllabus — turn any syllabus into a deadline calendar",
  description:
    "Upload a course syllabus and HopSyllabus builds a calendar of every assignment, test, quiz and project deadline.",
};

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-10 place-items-center rounded-md bg-brand shadow-lg shadow-brand/20">
        <svg viewBox="0 0 40 40" className="size-8" aria-hidden="true">
          <path d="M8 21.5C8 12.6 14.8 6 24.1 6c4.7 0 7.8 1.3 9.9 3.1l-4 3.4c1.1 1.7 1.7 3.6 1.7 5.9 0 7.5-5.1 13.1-13 13.1-6.3 0-10.7-4.1-10.7-10Z" fill="#68ACE5" />
          <path d="m8.5 21.2-5.2 2.2 5.9 2.2 3.1-2.4Z" fill="#F1C400" />
          <path d="M27.5 13.2c2.2 1.6 3.5 4.1 3.5 7.1 0 5.3-3.7 9.2-9.2 9.2-2.8 0-5.2-1-6.9-2.7 6.4-.3 10.9-4 12.6-13.6Z" fill="#002D72" opacity=".85" />
          <circle cx="23.2" cy="15.8" r="2.6" fill="#fff" />
          <circle cx="23.8" cy="15.8" r="1" fill="#172B4D" />
          <path d="M19.1 25.2c2.5 1.1 5.1.9 7.4-.4-1.7 2.8-4.4 4.4-7.8 4.4-2 0-3.7-.5-5.1-1.5 1.9.1 3.7-.8 5.5-2.5Z" fill="#fff" opacity=".9" />
        </svg>
      </span>
      <span className="font-serif text-xl font-semibold tracking-tight">
        Hop<span className="text-brand-soft">Syllabus</span>
      </span>
    </span>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${workSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-brand/15 bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-brand"
              >
                Dashboard
              </Link>
              <Link
                href="/calendar"
                className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-brand"
              >
                Calendar
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">{children}</main>

        <footer className="border-t border-line/70 py-6">
          <div className="mx-auto w-full max-w-7xl px-5 text-xs text-muted">
            HopSyllabus parses uploaded syllabi locally — always double-check the
            detected deadlines against your syllabus.
          </div>
        </footer>
      </body>
    </html>
  );
}
