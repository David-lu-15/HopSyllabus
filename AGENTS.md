<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Guidance for AI agents and contributors working on HopSyllabus.

HopSyllabus turns an uploaded course syllabus into a calendar of assignment, test,
quiz and project deadlines. See [README.md](./README.md) for the product overview.

## Branching and merging — NEVER push directly to `main`

- **Never commit or push directly to `main`.** The `main` branch is protected.
- **All changes must be made on a separate branch.**
  - Use a descriptive, lowercase, hyphenated branch name prefixed by type:
    - `feature/<short-description>`
    - `fix/<short-description>`
    - `chore/<short-description>`
    - `docs/<short-description>`
  - Example: `git switch -c fix/login-redirect-loop`
- **All changes must be merged through a pull request.**
  - Push the branch to the remote and open a pull request against `main`.
  - Do not merge your own unreviewed work; wait for review and required checks to pass.
  - Prefer squash merges so `main` keeps a clean, linear history.
- Do not force-push to shared branches. Force-push your own feature branch only, and only before review has started.

### Workflow

```sh
git switch main
git pull --ff-only
git switch -c feature/my-change
# ...make changes, commit...
git push -u origin feature/my-change
# Open a pull request into main; merge only after review and CI pass
```

## Commit messages

- Use the imperative mood and a short subject line (<= 72 characters).
- Reference the related issue or pull request when applicable, e.g. `Fix date parsing for week rows (#123)`.

## Pull requests

- Keep pull requests small and focused on a single concern.
- Describe what changed, why, and how it was verified.
- Run the checks below before requesting review.

## Commands

```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + type check
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

CI runs `typecheck`, `lint` and `build` on every pull request and every push to
`main` (`.github/workflows/ci.yml`); those are the checks to pass before review.

Requires Node 24+ because persistence uses the built-in `node:sqlite` module
(available without a flag from Node 23.4).

## Architecture notes

- `src/app/api/**` — route handlers. They are the only place the client talks to,
  besides page loads; both go through the same repo layer.
- `src/lib/db.ts` / `src/lib/repo.ts` — SQLite connection (a singleton on
  `globalThis`, because dev-mode hot reload re-evaluates modules) and all queries.
  Keep SQL inside `repo.ts`.
- `src/lib/parse/**` — the syllabus → deadline pipeline. `events.ts` owns the
  heuristics; keep new rules small and add a fixture under `tests/fixtures/` when
  you change them. Anything that could be a false positive must stay behind the
  confidence score so the user reviews it before it is saved.
- `src/lib/format.ts` — date helpers shared by server and client components.
  Deadlines are stored as timezone-free `YYYY-MM-DD` strings; parse them at local
  noon to avoid off-by-one rendering bugs.
- `src/components/**` — client components that mutate data call `router.refresh()`
  after a successful request so server components re-render.

## Conventions

- TypeScript strict mode; no `any` in new code.
- Validate every API payload with a Zod schema from `src/lib/validate.ts`.
- Keep user-facing copy plain and reassuring: parsed deadlines are always
  presented as *suggestions* the user can correct before saving.
- Run `npm run typecheck` and `npm run lint` before opening a pull request.
