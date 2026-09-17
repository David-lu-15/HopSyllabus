import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/25">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M9 3.5c0-.8.7-1.5 1.5-1.5S12 2.7 12 3.5V10H9V3.5Z" fill="#fff" opacity=".95" />
          <path d="M15 5c0-.8.7-1.5 1.5-1.5S18 4.2 18 5v5h-3V5Z" fill="#fff" opacity=".7" />
          <path
            d="M12 11.5c3.9 0 7 2.8 7 6.4 0 3-2.2 4.6-4.6 4.6H9.6C7.2 22.5 5 20.9 5 17.9c0-3.6 3.1-6.4 7-6.4Z"
            fill="#fff"
          />
          <circle cx="10" cy="16" r="1.1" fill="#4338ca" />
          <circle cx="14.5" cy="16" r="1.1" fill="#4338ca" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">
        Hop<span className="text-brand-soft">Syllabus</span>
      </span>
    </span>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Dashboard
              </Link>
              <Link
                href="/calendar"
                className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
