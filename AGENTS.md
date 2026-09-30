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

### URLs

- Browser-visible URLs are built with `encodeQueryComponent`, `encodePathSegment`, and `toQueryString` from `src/lib/url.ts`, never `encodeURIComponent` or `URLSearchParams#toString()`, so RQL and paths stay readable (`/genome?rql=eq(genus,Escherichia)`). Backend request URLs, external links, iframe sources, and RQL value escaping (`escapeRqlValue`) are exempt. Mutating `url.searchParams` re-escapes the whole query; build a separate `URLSearchParams` and serialize it with `toQueryString`.
- `encodePathSegment` leaves `:` literal, so use it only after a literal `/` (`/genome/${…}`). Template substitution that can put a value first (`resolveLink` in `metadata-link-policy.ts`) keeps `encodeURIComponent`, or a row value like `javascript:…` would survive as a scheme.

### Design-system lint (`@shadcn/lint`)

- `eslint.config.mjs` enables all six `shadcn/*` rules as errors (off for `no-restyle`, `no-arbitrary-values`, and `require-static-classes` inside `src/components/ui/**`, which owns component appearance, and inside `src/components/services/form-ui/**`, whose wrappers own the global `service-*` classes; `no-inline-styles` in the chart folders `organisms/metadata-distributions/**`, `organisms/geo-distribution/**` and `interactions/sigma/**` allows only the properties that carry runtime geometry and series colors (the `allow` list in `eslint.config.mjs`); static motion and borders there live in classes or the `@utility` rules in `globals.css`). The tree has no recorded violations, so every finding fails `pnpm lint`.
- Fix a finding in code, using the variant, theme token, or scale value the error suggests. When a call site needs a look no variant gives, add a named variant or size to the `ui/` component (exact classes, merged after the base) rather than restyling at the call site. Do not create an `eslint-suppressions.json` baseline or add `eslint-disable` comments to get past one.
- Colors are theme tokens, never palette classes: `destructive`, `success`, `warning`, `info`, `link` (link-like text), `highlight` (folder icons, favorite stars), plus the neutrals and `chart-1..10`. A new token needs a value in all 10 theme blocks (`src/app/globals.css` and `src/styles/themes/*.css`) and a `--color-*` entry in `@theme inline`.
- Runtime values go through a custom property with a static key and a class that reads it (``style={{ "--col-size": `${String(px)}px` }}`` with `w-(--col-size)`). A computed style key is reported as a dynamic style object.
- Service form parts use the `src/components/services/form-ui/` wrappers (`<ServiceCardHeader>`, `<ServiceLabel>`, …), never a `service-*` class on a `ui/` component. Classes passed to a wrapper are still checked against the part it wraps, and `no-restyle` contracts apply through it. The contracts in `eslint.config.mjs` are the authority (spacing on table cells and card parts, `opacity-*` reveals on `Button`/`TableHead`/`ResizableHandle`, anything on the unstyled `Collapsible` parts); each component matches exactly one entry, so keep the patterns disjoint. Widening a contract is a policy call; record the reason in a comment on it.
- Sub-`xs` text sizes are theme tokens: `text-2xs` (11px) and `text-3xs` (10px). Documented one-off exceptions live in the rule `allow` lists in `eslint.config.mjs`; add to them only for classes the app genuinely needs and cannot express with a token.
- A `text-*` size also sets its line height and, through `cn`, drops an earlier `leading-*`: `<Label className="text-sm">` is 20px tall where the base `text-sm leading-none` is 14px. Check the base before deleting a "redundant" size (Label has `leading="normal"` for this).
- The only sanctioned `eslint-disable-next-line shadcn/require-static-classes` comments are on `className` passthroughs whose value is authored as a static string elsewhere (e.g. TanStack column meta) — always with a `-- reason` naming that source. Selectable table rows use `<TableRow selectionIndicator data-state={selected ? "selected" : undefined}>` instead of restyling the row.
- These `src/components/ui/` files carry local edits (variants, sizes, base fixes) that `shadcn add --overwrite` would revert — check the diff when regenerating them: `alert`, `avatar`, `badge`, `button-variants`, `calendar`, `card`, `carousel`, `command`, `dialog`, `dropdown-menu`, `input`, `input-group`, `label`, `navigation-menu`, `number-input`, `popover`, `select`, `sheet`, `skeleton`, `sonner`, `table`, `tabs`, `textarea`, `tooltip`.

### Formatting

- Prettier has exactly one configuration source: the `prettier` key in `package.json`, which sets `printWidth: 80` and loads `prettier-plugin-tailwindcss`. A `.prettierrc` used to sit alongside it asking for 160, but Prettier resolves `package.json` first, so it was inert in its entirety and has been removed — do not reintroduce a second source. 80 is the lower-debt of the two widths, not a width the tree already matches.
- **Formatting is not enforced.** No script and no CI workflow runs Prettier, and most of the tree does not match the configured width. `prettier --check .` and `pnpm lint`'s `tailwindcss/classnames-order` rule both report a large pre-existing backlog; measure it yourself when you need the figure rather than trusting a count written here, which goes stale on the next commit. Adding a format gate (or running `prettier --write .`) therefore needs its own change with its own baseline — it must not ride along inside an unrelated commit, where it would bury every real edit.

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

- **New service** → copy the closest one under `src/app/services/(<category>)/`: page (TanStack Form + zod, parts from `src/components/services/form-ui/`) + `*-form-utils.ts` (constants/types/schema) + submission via `useServiceRuntime`/`useServiceFormSubmission` + rerun via `useRerunForm<T>()` and the `build{Paired,Single,Sra}Libraries` helpers in `src/lib/rerun-utility.ts`.
- **New data view** → register in `src/lib/views/view-registry.ts` + thin page under `src/app/(views)/`. Don't bypass the registry.
- **New workspace data access** → add a method to `workspace-repository.ts`, consume via `useWorkspaceRepository()`. Not `WorkspaceApiClient` directly.
- **New auth endpoint** → add a named operation in `src/lib/auth/server/actions.ts`, a concrete browser call in `src/lib/auth/client.ts` when needed, and a thin route under `src/app/api/auth/` using `{error, code}` (see `docs/auth-api.md`). Do not add a factory, port, or browser session endpoint.
- **New backend call** → via `JsonRpcClient` / `AppService` / workspace repository. Never raw `fetch`.
- **New async client state** → TanStack Query hook, not `useEffect` + `useState`.
- **New piece of UI state** → pick its home by what it is (full table in `docs/architecture.md` → "UI state"):
  - a small device preference the server renders (panel width, collapsed rail, a toggle) → a key in `src/lib/ui-preferences/definitions.ts`, read with `useUiPreference(key)`; the root layout seeds it from cookies so the first paint is right.
  - a table's column visibility/order/widths or visible facets → `useTableLayout("<table key>")` (localStorage, only differences from the defaults).
  - which rows a link shows (filters, sort, page) → the URL. Collection pages use `useCollectionUrlState`; a table nested in an entity page uses `ResourceChildCollection`'s required `urlKey` (`<urlKey>.page`, cleared on tab and parent-query changes); other lists follow `src/lib/jobs/jobs-url-state.ts` (parse/serialize with defaults omitted, written with `window.history` and `toQueryString`). A text box over URL state shows a draft (`useDebouncedDraft`): Next applies History API writes in a transition, so an input bound straight to the URL drops keystrokes.
  - Never read `localStorage` during render — use `useStorageItem` / `src/lib/browser-storage.ts`.
  - Never import a constant from a `"use client"` module into server code: it arrives as a client reference, not the value.

## Keeping guidance current

- When a change moves a file, renames a public entrypoint, adds a route group, or introduces a pattern future work should follow, update the affected doc in the same PR: durable always-load rules here, deep module map in `docs/architecture.md`, design detail in the relevant `docs/*`. A stale instruction misleads every future session.
- After structural changes, run `graphify update .` to keep the knowledge graph current (AST-only, free). Graphify usage is documented in the graphify skill; for codebase questions, prefer `graphify query "<q>"` over broad grep.

## E2E (Playwright)

- Specs under `/e2e/`; full runbook in `/e2e/README.md`. Do NOT duplicate Vitest coverage — Playwright is for multi-page journeys, cross-browser parity, and jsdom-impossible interactions (upload, drag/drop, 3D viewer, visual regression).
- All `/api/**` and outbound HTTPS (BV-BRC/PATRIC/TheSEED/NCBI) are mocked via `e2e/mocks/backends.ts`. Never depend on a live backend in CI.
- MCP `plugin:playwright` is available for interactive driving (`pnpm dev`, then `browser_navigate` to `http://localhost:3019`).
- MCP debug screenshots go in `.misc/.screenshots/` only — never commit them (`/.misc` is gitignored, and the misc-folder rule below puts them there rather than at the repo root).

## File Structure

- All miscellaneous folders (e.g. `/.playwright-mcp`) should be placed in the `/.misc` folder in the root of the repository, as should any new folder like them. Every *report and artifact* folder the Playwright and a11y configs write is already there: `test-results`, `playwright-report`, `a11y-report`, `a11y-results`, `a11y-meta-report`, `a11y-meta-results`. Two paths those configs write stay outside `/.misc` deliberately, because neither is a throwaway artifact: `e2e/__snapshots__` (committed visual baselines) and `e2e/.auth/` (generated storage state, gitignored where it sits). No config sets `--reporter=blob`, so no `blob-report` is produced; if you enable it, point `PLAYWRIGHT_BLOB_OUTPUT_DIR` under `/.misc` as well. The exceptions to this rule are established project, tool, output, and documentation roots: `/.claude`, `/.devcontainer`, `/.git`, `/.github`, `/.misc`, `/.next`, `/.playwright-mcp`, `/.superpowers`, `/.vscode`, `/auspice`, `/coverage`, `/docs`, `/e2e`, `/graphify-out`, `/node_modules`, `/patches`, `/plans`, `/public`, `/scripts`, and `/src`.