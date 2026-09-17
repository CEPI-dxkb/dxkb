# AGENTS.md

Repository guidance for coding agents. Keep this file lean because it is loaded every session. The deep module map lives in `docs/architecture.md` (read on demand). Detailed testing rules live in `.claude/rules/testing.md`.

## Commands

```bash
pnpm dev          # Dev server, Turbopack, port 3019
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit (catches test-file TS errors that build skips)
pnpm test         # Vitest (run once)
pnpm e2e          # Playwright (all browsers)
pnpm a11y         # Accessibility suite (own config: playwright.a11y.config.ts)
```

**Before committing, run `pnpm lint && pnpm typecheck && pnpm build && pnpm test`** — all four gate every PR in CI.

Requires **Node v24** (`nvm use 24`, pinned in `.nvmrc`). `pnpm start` = prod server on port 3010. More scripts (`test:watch`, `test:coverage`, `e2e:record`, `e2e:update-snapshots`, `a11y:*`, `build-pm2`) in `package.json`.

## Architecture (summary — full map in `docs/architecture.md`)

**DXKB V2**: Next.js 16 App Router bioinformatics platform (genomics, metagenomics, viral research).

- **App Router** (`src/app/`) — route groups `(auth)`, `(footer)`, `(views)`, plus `organisms/`, `workspace/`, `services/(<category>)`, `search/`, `jobs/`, `settings/`, `viewer/`, `api/`. Groups `(…)` don't appear in the URL.
- **Auth** (`src/lib/auth/`) — server-first BV-BRC auth. Server Components call `getCurrentUser()` from `server/actions.ts` and pass the browser-safe user to `<AuthBoundary>`; client consumers use `useAuth()` / `useAuthActions()` from `provider.tsx`. Cookie ownership is in `server/session.ts`, protected handlers use named exports from `server/route.ts`, and page classification stays in `routes.ts`.
- **Backend** — all calls via `JsonRpcClient` / `AppService` (`src/lib/`) or the workspace repository. JSON-RPC 2.0; never raw-`fetch` a backend URL.
- **Workspace** — repository pattern: `useWorkspaceRepository()` over `WorkspaceApiClient`. Orchestrator is `workspace-shell.tsx`.
- **Views** — registry-driven: `src/lib/views/view-registry.ts` feeds thin `(views)/*` pages and organism landing pages.
- **Services** — form pages using TanStack Form + zod; submit via `useServiceFormSubmission` → `AppService.start_app2`.
- **Data fetching** — TanStack Query for all async client state.
- **UI** — shadcn/ui (New York, slate) on `@base-ui` primitives; Tailwind v4 CSS-variable themes in `globals.css`; `sonner` toasts; `lucide-react` icons.

### Path aliases

- `@/` → `src/`. `@public/` → `public/`.

## Conventions

### Naming

- All variables and constants use `camelCase`, including module-level `const` exports. No `SCREAMING_SNAKE_CASE` (C/Java convention, not TS/JS). Exceptions: env var names (OS convention) and zod schema objects (camelCase anyway).

### Code organisation

- Module-level constants/types used by a service page belong in that service's `*-form-utils.ts`, not inline in the page component. Export and import them.

### Error handling

- Do NOT swap real errors for generic ones — the original message must still be displayed. Condense if too long, but preserve the meaning.

### Formatting

- Prettier has exactly one configuration source: the `prettier` key in `package.json`, which sets `printWidth: 80` (the width the tree is actually formatted to) and loads `prettier-plugin-tailwindcss`. A `.prettierrc` used to sit alongside it asking for 160, but Prettier resolves `package.json` first, so it was inert in its entirety and has been removed — do not reintroduce a second source.
- **Formatting is not enforced.** No script and no CI workflow runs Prettier. `prettier --check .` currently reports 737 files, and `pnpm lint` reports 31 standing `tailwindcss/classnames-order` warnings; both are pre-existing debt. Adding a format gate (or running `prettier --write .`) therefore needs its own change with its own baseline — it must not ride along inside an unrelated commit, where it would bury every real edit.

### Git

- Do NOT commit unless asked. All changes are reviewed manually first.

### Plans

- When creating a plan, also write a `.md` in `/plans` for documentation.

### React Compiler

Enabled via `reactCompiler: true` in `next.config.ts` — components are auto-memoized at build. For new code, rely on it; reach for `useMemo`/`useCallback` only for precise control (stable effect deps).

- **Do NOT bulk-remove existing memoization** — it can change compiled output. Removing `useMemo` from a context provider's `value` breaks `"use no memo"` consumers (compiler skips context values in opted-out subtrees). Only remove deliberately, with test coverage.
- **Opt-out**: a component using a hook the compiler can't memoize (such as TanStack Virtual's `useVirtualizer`) needs `"use no memo";` as the first statement in its body. When you add one, you MUST also add the file to the `files: [...]` list in `eslint.config.mjs` (silences `react-hooks/incompatible-library`). `src/__tests__/react-compiler-config.test.ts` guards that list — keep them in sync. Current opt-outs: `shared/data-table.tsx`, `workspace/file-viewer/viewers/csv-viewer.tsx`, `organisms/reference-genomes/reference-genomes-client.tsx`, `taxonomy/taxonomy-tree.tsx`.

## Staying on-pattern (read before adding anything new)

Find the existing example of the same shape and follow it:

- **New service** → copy the closest one under `src/app/services/(<category>)/`: page (TanStack Form + zod) + `*-form-utils.ts` (constants/types/schema) + submission via `useServiceRuntime`/`useServiceFormSubmission` + rerun via `useRerunForm<T>()` and the `build{Paired,Single,Sra}Libraries` helpers in `src/lib/rerun-utility.ts`.
- **New data view** → register in `src/lib/views/view-registry.ts` + thin page under `src/app/(views)/`. Don't bypass the registry.
- **New workspace data access** → add a method to `workspace-repository.ts`, consume via `useWorkspaceRepository()`. Not `WorkspaceApiClient` directly.
- **New auth endpoint** → add a named operation in `src/lib/auth/server/actions.ts`, a concrete browser call in `src/lib/auth/client.ts` when needed, and a thin route under `src/app/api/auth/` using `{error, code}` (see `docs/auth-api.md`). Do not add a factory, port, or browser session endpoint.
- **New backend call** → via `JsonRpcClient` / `AppService` / workspace repository. Never raw `fetch`.
- **New async client state** → TanStack Query hook, not `useEffect` + `useState`.

## Keeping guidance current

- When a change moves a file, renames a public entrypoint, adds a route group, or introduces a pattern future work should follow, update the affected doc in the same PR: durable always-load rules here, deep module map in `docs/architecture.md`, design detail in the relevant `docs/*`. A stale instruction misleads every future session.
- After structural changes, run `graphify update .` to keep the knowledge graph current (AST-only, free). Graphify usage is documented in the graphify skill; for codebase questions, prefer `graphify query "<q>"` over broad grep.

## E2E (Playwright)

- Specs under `/e2e/`; full runbook in `/e2e/README.md`. Do NOT duplicate Vitest coverage — Playwright is for multi-page journeys, cross-browser parity, and jsdom-impossible interactions (upload, drag/drop, 3D viewer, visual regression).
- All `/api/**` and outbound HTTPS (BV-BRC/PATRIC/TheSEED/NCBI) are mocked via `e2e/mocks/backends.ts`. Never depend on a live backend in CI.
- MCP `plugin:playwright` is available for interactive driving (`pnpm dev`, then `browser_navigate` to `http://localhost:3019`).
- MCP debug screenshots go in `.screenshots/` only — never commit them.

## File Structure

- All miscellaneous folders (e.g. `/.playwright-mcp`) should be placed in the `/.misc` folder in the root of the repository, as should any new folder like them. Every folder the Playwright and a11y configs write is already there: `test-results`, `playwright-report`, `a11y-report`, `a11y-results`, `a11y-meta-report`, `a11y-meta-results`. No config sets `--reporter=blob`, so no `blob-report` is produced; if you enable it, point `PLAYWRIGHT_BLOB_OUTPUT_DIR` under `/.misc` as well. The only exceptions to this rule are `/.claude`, `/.devcontainer`, `/.github`, `/.misc`, `/.next`, `/.vscode`, `/auspice`, `/.docs`, `/.e2e`, `/node_modules`, `/patches`, `/public`, `/scripts`, `/src`, and `/.git`.