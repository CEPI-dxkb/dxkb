# Testing Rules

## Node Version

Tests require **Node.js >= 22** (vitest 4.x / rolldown needs `node:util#styleText`). The project targets **Node v24**. Use `nvm use 24` (or the `.nvmrc` if present) before running any commands.

## Test Runner

The project uses **Vitest 4** with jsdom environment. Config lives in `vitest.config.mts`, setup in `vitest.setup.ts`.

```bash
pnpm test             # Run all tests once (vitest run)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Run with V8 coverage
```

## Coverage

V8 coverage with floor thresholds enforced by `pnpm test:coverage` (see `vitest.config.mts`):

| Metric | Floor |
|---|---|
| lines | 81 |
| statements | 80 |
| functions | 84 |
| branches | 70 |

- Floors sit just below the measured baseline so unrelated PRs don't trip on rounding drift. Bump them upward when new tests raise the measured numbers; never lower them.
- Scope: `src/lib/**`, `src/hooks/**`, `src/contexts/**`, `src/app/api/**`, `src/app/services/page.tsx`. Excludes `src/components/ui/**`, `*.d.ts`, and `types.ts` / `types/**`.
- Reporters: `text`, `html`, `json-summary`, `json` (HTML report at `coverage/index.html`).

## CI / GitHub Actions

Four workflows run automatically on every PR targeting `main`:

| Workflow | File | Command |
|---|---|---|
| Lint | `.github/workflows/pnpm-lint.yml` | `pnpm lint` |
| Typecheck | `.github/workflows/pnpm-typecheck.yml` | `pnpm typecheck` |
| Build | `.github/workflows/pnpm-build.yml` | `pnpm build` |
| Test | `.github/workflows/pnpm-test.yml` | `pnpm test` |

All four must pass before merging. `pnpm typecheck` runs `tsc --noEmit` and catches TS errors in test files that `pnpm build` skips.

## Test Before Committing

Before committing any changes, run the following commands locally to catch errors before CI does:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## Test Conventions

- Test files live in `__tests__/` directories next to the source they cover (e.g. `src/lib/__tests__/utils.test.ts`).
- Use `vi.mock()` for module mocks. Do not reference variables declared with `const`/`let` inside a `vi.mock` factory — vitest hoists the factory above all imports, so the variable will not be initialized yet. Instead, import the mocked module inside the test and access its mock there.
- Prefer `expect.objectContaining()` over non-null assertions (`!`) to satisfy the `@typescript-eslint/no-non-null-assertion` rule.
- Globals (`describe`, `it`, `expect`, `vi`) are available without importing (configured via `globals: true`).

## Shared Test Helpers

`src/test-helpers/` contains the building blocks shared across the unit suite — prefer these over hand-rolling per-test:

- `msw-server.ts` — Shared MSW server (see "Mocking HTTP Requests with MSW" below).
- `api-route-helpers.ts`:
  - `mockNextRequest({ method, url, body, headers, searchParams })` — Build a `NextRequest` for route handler tests. Use this instead of `new Request(...)` or hand-rolling Next internals.
  - `createQueryClientWrapper()` — `QueryClientProvider` wrapper (with `retry: false`) for `renderHook` and React tests that touch TanStack Query.
  - `makeRouteContext(id)` — Build the `{ params: Promise<…> }` second argument for App Router route handlers.
  - `json(res)` — Tiny `res.json()` shorthand.

See `src/app/api/auth/profile/__tests__/route.test.ts` for a representative usage.

## Mocking HTTP Requests with MSW

Use [MSW (Mock Service Worker)](https://mswjs.io/docs/) to intercept HTTP requests in tests — do **not** use `vi.mock()` to mock functions like `fetch` or `serverAuthenticatedFetch`. MSW intercepts at the network level, which exercises the real request code paths (headers, serialization, error handling).

- A shared MSW server is configured in `src/test-helpers/msw-server.ts` with lifecycle hooks in `vitest.setup.ts` (strict mode — unhandled requests error).
- Use `server.use()` inside individual tests to add request handlers. Handlers are automatically reset after each test via `afterEach(() => server.resetHandlers())`.
- For server-side code that depends on `next/headers` cookies (e.g. `getSession`, `getAuthToken`, `serverAuthenticatedFetch`), mock `next/headers` with a `mockCookieStore` via `vi.hoisted()` to control auth state, and let the real functions run so their `fetch()` calls hit MSW:

```ts
const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));
```

- Set env vars (e.g. `process.env.USER_URL`) in `beforeEach` / `afterEach` instead of mocking `getRequiredEnv`.
- See `src/lib/auth/__tests__/session.test.ts` and `src/app/api/auth/profile/__tests__/route.test.ts` for reference examples.

## Linting Rules

- All variables and constants use `camelCase` — including module-level `const` exports. Do not use `SCREAMING_SNAKE_CASE` for constants (that is a C/Java convention, not TypeScript/JavaScript).
- The only exceptions are environment variable names (OS convention) and zod schema objects which conventionally use camelCase anyway.
- Do not use `//eslint-disable` comments, fix the code instead. If you absolutely must use them, add a comment explaining why.

## Playwright (E2E) Rules

### Scope

- E2E specs live under `/e2e/tests/**`. One spec file per route family; visual-regression specs under `/e2e/tests/visual/`.
- Do **not** add Playwright tests that duplicate Vitest coverage (auth route handlers, hooks, contexts, units). Reserve Playwright for: multi-page browser journeys, cross-browser parity, and jsdom-impossible interactions (file upload, drag/drop, 3D viewer).
- Accessibility sweeps run via axe-core (`e2e/tests/a11y.spec.ts`) — extend that spec when adding routes that need a11y coverage rather than spreading axe checks across journey specs.
- Before committing: `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm e2e --project=chromium` for a fast local check (full three-browser matrix runs in CI).

### Page Objects

Specs interact with the app through page objects in `e2e/pages/` (e.g. `SignInPage`, `WorkspacePage`, `ServiceFormPage`, `JobsListPage`). New specs should add or extend a page object rather than embedding raw selectors. Each page object is a thin wrapper exposing `goto()`, semantic actions (`signIn()`, `uploadFile()`, etc.), and assertions — keep it focused on the page's surface, not test logic.

### Setup Projects + Storage State

`playwright.config.ts` defines two setup projects that run before browser projects:

- `setup-signed-in` (`e2e/auth/signed-in.setup.ts`) — Authenticates and writes `e2e/.auth/user.json`. The `chromium`, `firefox`, and `webkit` projects depend on it and load that storage state by default.
- `setup-public` (`e2e/auth/public.setup.ts`) — Empty storage state for unauthenticated specs.

Specs that must run logged-out should override with `test.use({ storageState: { cookies: [], origins: [] } })` (or the public storage path) at the top of the spec.

### Backend Mocking

Two layers, both required for full isolation:

1. **Browser-side** — `applyBackendMocks(page, { har, overrides })` from `e2e/mocks/backends.ts` intercepts requests made from the page via `page.route()`.
2. **Server-side (loopback)** — Server components and route handlers fetch through env vars (e.g. `APP_SERVICE_URL`) that `.env.e2e.test` rewrites to `http://127.0.0.1:${E2E_PORT}/api/e2e-mock/<service>`. The loopback handler at `src/app/api/e2e-mock/[...path]/route.ts` serves the same HARs/overrides. Playwright's `page.route()` cannot see server-side fetches, so this layer is mandatory — without it, RSC/route-handler fetches make real outbound calls.

Because of the env-loading dance, the Playwright `webServer` runs `node e2e/scripts/start-webserver.mjs ${port}` instead of `next start` directly. Run `pnpm build` before `pnpm e2e` (the wrapper does not rebuild).

### HAR Replay Modes

- **Strict replay** — Pass a HAR path to `applyBackendMocks` and matching requests are served verbatim. Used for read-only journeys (e.g. `auth.spec.ts`).
- **Body-aware journey replay** — Use `harOverridesFor(journey, { callIndex })` from `e2e/scripts/har-overrides.ts` when the same endpoint must return different bodies across sequential calls (e.g. workspace mutations that reflect uploads/folder creation in subsequent reads). See `e2e/tests/workspace-actions.spec.ts`.
- HAR files live in `e2e/fixtures/hars/` (committed). Record with `pnpm e2e:record <journey>` against a real backend (local only — never in CI).
- Hand-written overrides live in `e2e/fixtures/overrides/` and run before HAR replay.

### Snapshots

- Chromium: strict (zero-pixel diff).
- Firefox / WebKit: `maxDiffPixelRatio: 0.05`.
- Update baselines via `pnpm e2e:update-snapshots` and review PNG diffs in the PR.

