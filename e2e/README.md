# E2E (Playwright)

Browser-driven end-to-end tests for DXKB V2. Complements the 134 Vitest files under `src/**` — Vitest still covers units, hooks, contexts, API routes, and auth internals. Playwright covers what jsdom can't: real browser rendering across Chromium/Firefox/WebKit, multi-page journeys with real cookies, file upload/drag-drop, 3D viewers, and visual regressions.

## Commands

```bash
pnpm e2e                       # Run all specs against all three browsers
pnpm e2e --project=chromium    # Run one browser
pnpm e2e:ui                    # Open Playwright UI runner
pnpm e2e:debug                 # Open the inspector
pnpm e2e:codegen               # Record selectors against a running app
pnpm e2e:report                # Open last HTML report
pnpm e2e:update-snapshots      # Regenerate visual baselines
pnpm e2e:record <journey>      # Record a HAR against live backend (manual, local only)
```

The suite runs against a **production build** on port `3020` (independent from `pnpm dev` on 3019 and `pnpm start` on 3010). Playwright's `webServer` config starts `next start -p 3020` automatically; it does **not** build the app for you. Run `pnpm build` before `pnpm e2e` after any source change. The `pnpm e2e` script in `package.json` wires this together; CI runs `pnpm build` as a separate workflow step for the same reason.

Override the port with `E2E_PORT=3030 pnpm e2e --project=chromium`. The wrapper substitutes `${E2E_PORT}` in every backend URL in `.env.e2e.test` so server-side fetches still reach the correct loopback mock.

## Layout

```
e2e/
  auth/                         # Playwright setup projects (storageState generators)
    signed-in.setup.ts          # Seeds mocked auth cookies → e2e/.auth/user.json
    public.setup.ts             # Empty storageState for public specs
  mocks/
    backends.ts                 # applyBackendMocks(page, { har, overrides })
  pages/                        # Page-object helpers (SignInPage, …) — import from "../pages"
  fixtures/
    hars/                       # Recorded HAR files (committed)
    overrides/                  # Hand-written JSON overrides (committed)
  scripts/
    record-har.ts               # Manual HAR recorder
  tests/
    auth.spec.ts                # Sign-in redirects, submit payload, sign-out journey
    public.spec.ts              # /, /services, /workspace/public, footer pages
    workspace.spec.ts           # Signed-in workspace browsing
    services/services-smoke.spec.ts  # Parametrized h1 smoke for all 21 services
    jobs.spec.ts                # Jobs list + detail
    a11y.spec.ts                # axe-core sweep on home, sign-in, workspace, jobs, genome-assembly
    viewer-3d.spec.ts           # Mol* /viewer/structure container + WebGL canvas paint
    search-keyboard.spec.ts     # Navbar SearchBar keyboard journey + clipboard paste
    visual/visual.spec.ts       # Screenshot baselines
  __snapshots__/                # Visual regression baselines (per browser)
```

## Mocking strategy

All `/api/**` and outbound HTTPS to `*.patricbrc.org`, `*.bv-brc.org`, `*.theseed.org`, `*.ncbi.nlm.nih.gov` are mocked. Three layers (registered into the Playwright routing stack in this order so LIFO precedence gives overrides the first shot):

1. **JSON overrides** (`e2e/fixtures/overrides/*`) — hand-written responses. Highest precedence.
2. **HAR replay** (`page.routeFromHAR`) — recorded traffic. Runs after overrides via `notFound: "fallback"`.
3. **Strict guard** — any backend request not matched by the above is aborted with `route.abort("failed")` and logged as `[applyBackendMocks/strict]` to the test output.

Non-backend requests (Next.js assets, fonts, CDN) always pass through regardless of strict mode.

Call `applyBackendMocks(page, { overrides, har? })` in a `beforeEach`. **Strict is the default.** If you genuinely need to let real backend calls through for an exploratory test, pass `strict: false`.

The permissive catch-all `permissiveBackendOverrides` (from `e2e/fixtures/overrides`) covers `/api/auth/`, `/api/services/`, `/api/workspace/`, and the four backend hosts with generic 200 responses — use it as the last spread in your override list for the "I just want the page to render" case, after specific fixtures.

### Server-side backends: loopback isolation

`page.route()` only intercepts *browser* requests. Server components and API route handlers make their own outbound fetches to `APP_SERVICE_URL`, `WORKSPACE_API_URL`, `USER_URL`, etc. before the page is streamed, and those fetches bypass Playwright entirely — previously they failed with "JSON-RPC call failed: HTTP error! status: 500" and flooded the webServer log on every render.

To fix this the test server runs through a wrapper that seeds the right env vars before Next starts:

- **`e2e/scripts/start-webserver.mjs`** is what `playwright.config.ts`'s `webServer.command` launches. It resolves the port (CLI arg > `E2E_PORT` > `3020`), then reads `.env.e2e.local` (optional) followed by `.env.e2e.test` (required) via `node:util`'s `parseEnv`, merging each key into `process.env` under `node --env-file=` semantics (existing values win). Values can reference `${E2E_PORT}`; the wrapper substitutes the resolved port at load time so the committed file stays port-agnostic. Finally it spawns `next start -p <port>` — it does **not** run `next build`, because a cold build exceeds Playwright's webServer timeout and blocks targeted runs. Run `pnpm build` yourself first. We can't just use `node --env-file=` here because that flag leaks into `NODE_OPTIONS` and Next's build worker threads reject `NODE_OPTIONS` containing `--env-file` (`ERR_WORKER_INVALID_EXEC_ARGV`).
- **`.env.e2e.test`** (committed, loaded by the wrapper) points every backend URL at a loopback mock: `http://127.0.0.1:${E2E_PORT}/api/e2e-mock/<service>`.
- **`.env.e2e.local`** (gitignored, loaded by the wrapper if present) is for local-only overrides. Because the wrapper loads `.env.e2e.local` **before** `.env.e2e.test`, any key set in the local file wins over the committed default. A shell-exported variable beats both.
- **`src/app/api/e2e-mock/[...path]/route.ts`** answers those loopback requests. `GET → 200 {}`, `POST → 200 {"id":1,"jsonrpc":"2.0","result":[[]]}`. Hits are logged as `[api/e2e-mock] <METHOD> /<path>` so fixtures can be promoted into overrides later.
- The handler is guarded by `E2E_MOCK_ENABLED=1` (set in `.env.e2e.test`). Without that flag every handler returns 404, so a production build that somehow shipped this file can't serve fake data.

If you add a new server-side backend dependency, add its env var to `.env.e2e.test` pointing at `/api/e2e-mock/<something>`. No code changes needed beyond that.

## Page objects

`e2e/pages/` holds thin wrappers around the selectors and interactions for each major page. Import from `../pages` and drive the page through the wrapper rather than re-finding selectors in every spec:

```ts
import { SignInPage } from "../pages";

const signIn = new SignInPage(page);
await signIn.goto("/workspace");          // goto with optional redirect=
await signIn.fill(username, password);
await signIn.submit();
await signIn.expectInlineError(/invalid/i);
```

Add a new page object when a spec starts repeating the same selector tuple twice, not preemptively — the wrappers are meant to encode the actual shape of the page, not a speculative surface.

## Recording a HAR

1. `cp .env.e2e.example .env.e2e` and fill in valid BV-BRC creds (never commit).
2. In one shell: `pnpm dev`.
3. In another: `pnpm e2e:record workspace-home`.
4. A headed Chromium opens. Sign in, drive the flow you want to capture.
5. Press Enter in the terminal to close. The HAR lands in `e2e/fixtures/hars/workspace-home.har`.
6. Commit the HAR. Re-record when the API contract drifts.

## Visual regression

Baselines live in `e2e/__snapshots__/`, one per `(spec, browser, platform)` triple. Chromium is strict (zero-pixel diff). Firefox and WebKit allow `maxDiffPixelRatio: 0.05` to absorb font/AA differences.

We commit both `*-linux.png` (for CI on `ubuntu-latest`) and `*-darwin.png` (for local Macs) so visual tests work out of the box on both. Windows contributors regenerate their own `*-win32.png` locally and are not expected to commit them.

### Regenerate on macOS

For intentional UI changes, first refresh your local (Darwin) baselines:

```bash
pnpm e2e:update-snapshots
git add e2e/__snapshots__
```

### Regenerate Linux baselines (for CI)

**Preferred — pull from a failing CI run.** Open a PR with your UI change, let the e2e job fail on the visual diff, then download the actuals and commit them:

```bash
# Find the failed run id for your PR
gh run list --workflow="E2E (Playwright)" --branch=<your-branch> --limit 1

# Download all artifacts
gh run download <run-id> --dir /tmp/dxkb-ci

# Copy actuals into the baseline dir (adjust page/browser to match what failed)
DEST=e2e/__snapshots__/tests/visual/visual.spec.ts-snapshots
for B in chromium firefox webkit; do
  for P in home sign-in workspace genome-assembly jobs; do
    ACTUAL=$(find /tmp/dxkb-ci/playwright-report-$B -type d -name "*-snapshot-$B" \
      -exec find {} -name "$P-actual.png" \; 2>/dev/null | head -1)
    [ -n "$ACTUAL" ] && cp "$ACTUAL" "$DEST/$P-$B-linux.png"
  done
done

git add e2e/__snapshots__
```

This is the only way to get byte-exact parity with GitHub Actions runners.

**Do not** use `docker run --platform linux/amd64 mcr.microsoft.com/playwright:X-noble …` on Apple Silicon. QEMU emulation produces ~20-24 px height differences and ~6% pixel drift vs native amd64, which busts chromium's zero-tolerance. The image works on a native amd64 host (EC2, GitHub Codespaces) if you have one.

Review the PNG diffs in the PR before merging.

## Browser matrix

Every PR runs three jobs via GitHub Actions (`.github/workflows/pnpm-e2e.yml`): chromium, firefox, webkit. Each shard caches its own browser binary in `~/.cache/ms-playwright`. Reports upload as artifacts on failure.

## Agents: driving the app interactively

Two paths, depending on what the agent needs to do.

**Playwright MCP (preferred for exploration)** — the `plugin:playwright` MCP server is available in this repo's Claude sessions:

```text
1. Start the dev server:  pnpm dev
2. Use browser_navigate:  http://localhost:3019
3. Use browser_snapshot, browser_click, browser_type, etc.
```

**Pnpm scripts (for running the suite)** — use the `pnpm e2e*` commands above from a Bash tool.

## Cross-cutting specs

**`a11y.spec.ts`** — runs `@axe-core/playwright` on home, sign-in, workspace, the genome-assembly form, and jobs. Fails on `serious` or `critical` violations; logs `moderate`/`minor` ones via `console.warn`. A short list of pre-existing rule IDs is disabled at the top of the spec (with comments) so the suite can land green; tighten that list as the underlying issues are fixed.

**`viewer-3d.spec.ts`** — drives `/viewer/structure/<path>`, mocks `/api/workspace/view/...` with a minimal one-atom PDB, and asserts the page chrome + Mol* container render. The full WebGL canvas-paint assertion is gated on Mol*'s own runtime probe — if Mol* surfaces "WebGL does not seem to be available" (e.g. headless Chromium without GPU), the paint test self-skips. Firefox and WebKit are skipped wholesale because their headless WebGL stacks are unreliable.

**`search-keyboard.spec.ts`** — covers the keyboard journey through the navbar `SearchBar`: type → Enter → routed to `/search?q=...&searchtype=everything`, empty submission stays put, clipboard paste fills the input (Chromium / Firefox; WebKit's headless clipboard permissions are unreliable). The repo has no Cmd+K command palette today — the dead `CommandSearch` component binds Cmd+J and is never mounted — so the spec exercises the real navbar form instead.

## When to add a Playwright test vs a Vitest test

- **Vitest** for: pure functions, hooks, contexts, API route handlers, components that render fine in jsdom.
- **Playwright** for: multi-page flows, real-cookie auth, file upload, drag/drop, 3D viewer, iframes, CSS/layout regressions, cross-browser parity.

If a single render-and-assert test would pass in jsdom, keep it in Vitest. Playwright is for journeys and browser-level truth.
