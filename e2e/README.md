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
    signed-in.setup.ts          # Seeds mocked auth cookies → e2e/.auth/<config>-signed-in.json
    public.setup.ts             # Empty storageState for public specs
    storage-state.ts            # Per-config storage-state paths (keyed by setup project name)
  mocks/
    backends.ts                 # applyBackendMocks(page, { overrides })
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
    a11y/                       # Accessibility suite — own config, see e2e/a11y/README.md
    viewer-3d.spec.ts           # Mol* /viewer/structure container + WebGL canvas paint
    search-keyboard.spec.ts     # Navbar SearchBar keyboard journey + clipboard paste
    visual/visual.spec.ts       # Screenshot baselines
  __snapshots__/                # Visual regression baselines (per browser)
```

## Mocking strategy

All `/api/**` and outbound HTTPS to `*.patricbrc.org`, `*.bv-brc.org`, `*.theseed.org`, `*.ncbi.nlm.nih.gov` are mocked. Two layers are registered into the Playwright routing stack so LIFO precedence gives overrides the first shot:

1. **JSON overrides** (`e2e/fixtures/overrides/*`) — hand-written responses plus body-aware overrides generated from recorded HARs. Highest precedence.
2. **Strict guard** — any backend request not matched by an override is aborted with `route.abort("failed")` and logged as `[applyBackendMocks/strict]` to the test output.

Non-backend requests (Next.js assets, fonts, CDN) always pass through regardless of strict mode.

Call `applyBackendMocks(page, { overrides })` in a `beforeEach`. **Strict is the default.** If you genuinely need to let real backend calls through for an exploratory test, pass `strict: false`.

`emptyBackendFallbackOverrides` (from `e2e/fixtures/overrides`) covers `/api/auth/`, `/api/services/`, `/api/workspace/` with generic, data-free 200 responses — spread it last in your override list so it answers anything a more specific override in your list didn't. It never returns named business data, so it's safe to include in any spec regardless of what that spec is testing.

#### Canonical fixture records (`e2e/fixtures/overrides/catchall.ts`)

The populated business-entity fixtures inside `catchall.ts` (genome, taxonomy, epitope, experiment, surveillance, serology, protein structure, etc.) are built from typed, dependency-free records in `src/lib/e2e-fixtures/records.ts` and wrapped per-transport by `src/lib/e2e-fixtures/envelopes.ts`. The **same** records back the server-side loopback mock (`src/app/api/e2e-mock/[...path]/route.ts`) — before this module existed, each layer hand-rolled its own copy and they drifted (e.g. epitope `host_name` was an array in one file and a bare string in the other). `src/lib/e2e-fixtures/__tests__/records.test.ts` parses every record with the production Zod schemas from `src/lib/data-api/schemas.ts`. `src/lib/e2e-fixtures/__tests__/transport-parity.test.ts` calls the real server-side `route.ts` handler and compares its response against the real, statically-defined bodies in the matching `catchall.ts` bundle — it imports `catchall.ts` directly (a type-only `import type` keeps the Playwright runtime out of that import chain, so this works fine from a Vitest test). For each of the 7 resources it covers, it diffs the gateway GET entry, the gateway POST entry (except `genome`'s, which is a dynamic function, not a static literal), and the e2e-mock loopback GET entry where one exists with real data (`experiment`, `surveillance`, `serology`) — see the test file's own doc comment for the exact per-resource breakdown. A future edit that re-inlines a diverging literal into any of those covered call sites fails loudly instead of drifting silently.

`records.ts` also owns the fixtures that are not `/api/data` resources: the BV-BRC *website* API tables `organismTaxonomyRecords` and `organismSummaryRecords` (keyed by taxon id, the pair behind every organism landing page and `/taxonomy/<id>`), the Brucella PPI rows and their collection total, and a `genome_amr` row. The two organism tables are kept 1:1 and their counts kept in agreement by `records.test.ts` — a taxon present in one and missing from the other renders half a page, which is exactly how `/taxonomy/1763` used to reach the framework error boundary.

**Import boundary.** `src/lib/e2e-fixtures/**` may only be imported from `src/lib/e2e-fixtures/**`, `src/app/api/e2e-mock/**`, and `e2e/fixtures/overrides/**`. A `no-restricted-imports` zone in `eslint.config.mjs` enforces it and `src/__tests__/e2e-fixtures-import-boundary.test.ts` pins the allowlist against the files that actually import the module, in both directions. `server-only` is deliberately not used: Playwright's own Node process imports the override bundles that re-export these records.

`catchall.ts` exports two kinds of things — import the most specific one your spec needs:

- **`emptyBackendFallbackOverrides`** — generic, data-free responses (`/api/auth/`, `/api/services/`, `/api/workspace/`). Safe anywhere; never returns named business data a test didn't ask for.
- **Named resource scenario bundles** — one per resource (`genomeScenarioOverrides`, `epitopeScenarioOverrides`, `taxonomyScenarioOverrides`, `experimentScenarioOverrides`, `biosetScenarioOverrides`, `surveillanceScenarioOverrides`, `serologyScenarioOverrides`, `proteinStructureScenarioOverrides`, `proteinFeatureScenarioOverrides`, `genomeFeatureScenarioOverrides`, `genomeSequenceScenarioOverrides`, `strainScenarioOverrides`, `epitopeAssayScenarioOverrides`). Every journey/view/smoke/visual spec in the suite imports the specific bundle(s) it actually exercises, plus `emptyBackendFallbackOverrides` for everything else, instead of a blanket catch-all.
- **`taxonomyTreeScenarioOverrides`** — the one named bundle scoped to a *boundary* rather than a resource. The Taxa Tree reads from its own same-origin route (`/api/taxonomy-tree/children` and `/api/taxonomy-tree/child-counts`), not from `/api/data/taxonomy`, so `taxonomyScenarioOverrides` does not cover it. The bundle is data-free (`{rows: []}` / `{counts: {}}`), so it is what a spec imports when it mounts the tree *incidentally* and only needs the strict guard satisfied — that guard aborts an unmocked `/api/**` request and fails the test on teardown (`e2e/tests/organisms/all.spec.ts` and the a11y sweep use it this way). A spec that exercises the tree itself does not import this bundle: it supplies its own content-bearing entries for both operations, since an empty `{rows}`/`{counts}` earlier in the list would win under first-match ordering and leave every node a leaf. See `e2e/tests/taxonomy-tree.spec.ts`.

`namedResourceScenarioOverrides` and `apiCatchallOverrides` compose all the named bundles (± the empty fallback) as internal, unexported building blocks — nothing outside `catchall.ts` imports them. **`a11yBackendOverrides`** is the one broad, unscoped aggregate this module exports (every named bundle + the empty fallback + external-host stubs), reserved for the accessibility sweep (`e2e/tests/a11y/*.spec.ts`), which scans dozens of routes spanning every resource type in one pass. Do not import it outside `e2e/tests/a11y/`.

### Server-side backends: loopback isolation

`page.route()` only intercepts _browser_ requests. Server components and API route handlers make their own outbound fetches to `APP_SERVICE_URL`, `WORKSPACE_API_URL`, `USER_URL`, etc. before the page is streamed, and those fetches bypass Playwright entirely — previously they failed with "JSON-RPC call failed: HTTP error! status: 500" and flooded the webServer log on every render.

To fix this the test server runs through a wrapper that seeds the right env vars before Next starts:

- **`e2e/scripts/start-webserver.mjs`** is what `playwright.config.ts`'s `webServer.command` launches. It resolves the port (CLI arg > `E2E_PORT` > `3020`), then reads `.env.e2e.local` (optional) followed by `.env.e2e.test` (required) via `node:util`'s `parseEnv`, merging each key into `process.env` under `node --env-file=` semantics (existing values win). Values can reference `${E2E_PORT}`; the wrapper substitutes the resolved port at load time so the committed file stays port-agnostic. Finally it spawns `next start -p <port>` — it does **not** run `next build`, because a cold build exceeds Playwright's webServer timeout and blocks targeted runs. Run `pnpm build` yourself first. We can't just use `node --env-file=` here because that flag leaks into `NODE_OPTIONS` and Next's build worker threads reject `NODE_OPTIONS` containing `--env-file` (`ERR_WORKER_INVALID_EXEC_ARGV`).
- **`.env.e2e.test`** (committed, loaded by the wrapper) points every backend URL at a loopback mock: `http://127.0.0.1:${E2E_PORT}/api/e2e-mock/<service>`.
- **`.env.e2e.local`** (gitignored, loaded by the wrapper if present) is for local-only overrides. Because the wrapper loads `.env.e2e.local` **before** `.env.e2e.test`, any key set in the local file wins over the committed default. A shell-exported variable beats both.
- **`src/app/api/e2e-mock/[...path]/route.ts`** answers those loopback requests, and its dispatch is **fail-closed**. Every path / JSON-RPC-method combination it serves is named in the module; anything else gets a `400` whose `reason` says exactly what is missing, and the same reason is written to the webServer log as `[api/e2e-mock] e2e-mock: …`. So `grep '\[api/e2e-mock\] e2e-mock: ' <playwright output>` is how you find out whether a run hit a fixture gap. Every rejection carries that prefix **by construction**: callers pass a label, never a whole `error` string, and `rejectionError()` builds it — the JSON-RPC branch included, which answers with an error envelope rather than that body. Two kinds of non-2xx deliberately stay outside the prefix, because they are fixture behaviour rather than gaps and folding them in would make the grep useless: the `E2E_MOCK_ENABLED` guard's 404, and `identity.ts`'s 401/404 for bad credentials and an unknown user. Only the 401s are asserted by a spec (`auth.spec.ts`); the 404 is a catch-all for any unrecognised `user/<id>`, so it doubles as the fixture gap for a profile this mock does not model. That is harmless today because `getProfile` is only ever called for the session user, but a spec that seeds a second user would hit a real gap this grep cannot see. `route.test.ts` pins both halves — one test drives all eight rejection branches through the prefix, and a second scans the route module's source so a new branch cannot answer 4xx on its own without failing. It never answers an unknown request with an empty success — a silent `{}` renders a real page with no data, so a spec passes asserting nothing (or, as `/taxonomy/1763` did, renders an error boundary that gets recorded as a page defect). Hits are logged as `[api/e2e-mock] <METHOD> /<path><query>`.
  - `GET` — identity, `phylo-manifest`, the `bvbrc-website` taxonomy/summary/genome fixtures, and the `data/<core>` Solr fixtures.
  - `POST` — `bvbrc-website/genome_amr` (with body validation), the identity endpoints, and the four JSON-RPC calls in `loopbackRpcResults` (`workspace` → `Workspace.ls` / `Workspace.get`; `app-service` → `AppService.query_task_summary_filtered` / `query_app_summary_filtered`). Those four answer empty, each with a comment stating why empty is the correct answer for that contract; they are the only combinations an instrumented run of the full Chromium suite plus `pnpm a11y` observed reaching the loopback.
  - `PUT` / `DELETE` — nothing. The same instrumented run recorded no PUT or DELETE reaching the handler at all.
- The handler is guarded by `E2E_MOCK_ENABLED=1` (set in `.env.e2e.test`). Without that flag every handler returns 404, so a production build that somehow shipped this file can't serve fake data.

If you add a new server-side backend dependency, add its env var to `.env.e2e.test` pointing at `/api/e2e-mock/<something>` **and** register the path (and, for JSON-RPC, the method) in `route.ts`. The env var alone is no longer enough: the handler is fail-closed, so an unregistered call gets a `400` naming itself rather than a silent success. That failure is the point — it tells you which fixture to write.

Do not infer from a green browser-side run that the loopback is complete. `page.route()` cannot see a Server Component's fetch, and `emptyBackendFallbackOverrides` deliberately swallows broad auth/services/workspace families before they leave the page. The two accommodations are separate: the browser-side empty fallback exists so a spec need not declare traffic it does not care about; the loopback has no equivalent and must not grow one.

## Page objects

`e2e/pages/` holds thin wrappers around the selectors and interactions for each major page. Import from `../pages` and drive the page through the wrapper rather than re-finding selectors in every spec:

```ts
import { SignInPage } from "../pages";

const signIn = new SignInPage(page);
await signIn.goto("/workspace"); // goto with optional redirect=
await signIn.fill(username, password);
await signIn.submit();
await signIn.expectInlineError(/invalid/i);
```

Add a new page object when a spec starts repeating the same selector tuple twice, not preemptively — the wrappers are meant to encode the actual shape of the page, not a speculative surface.

## Recording a HAR

`pnpm e2e:record <journey>` captures real backend traffic into `e2e/fixtures/hars/<journey>.har`. Specs convert recorded entries into body-aware JSON overrides with `harOverridesFor()` so they assert against the real BV-BRC response shape rather than hand-maintained mocks. Two recording modes:

**Scripted (preferred — used by the bi-weekly refresh workflow):** drop a driver at `e2e/scripts/journeys/<name>.ts` exporting `drive(page, env)` (see `e2e/scripts/journeys/README.md`). The recorder runs it headless against `E2E_RECORD_BASE_URL` (default `http://127.0.0.1:3010`, the production build). Use this when you want determinism — the same driver records the same flow every time, which is what makes the cron'd refresh meaningful.

**Interactive (one-off exploration):** if no driver file exists for the journey name, the recorder launches a headed Chromium and waits for you to drive the flow manually, then press Enter.

Steps:

1. `cp .env.e2e.example .env.e2e` and fill in valid BV-BRC creds (gitignored — never commit).
2. `pnpm build && pnpm start` — recording uses the production build to avoid development-only HMR traffic and keep HAR output deterministic.
3. `pnpm e2e:record workspace-browse` (or your journey name).
4. The recorder filters non-backend traffic (skips `_next/static`, fonts, images), scrubs the live username/password/email out of all bodies, and rewrites the recorded host to `http://e2e-har-replay.local`. `harOverridesFor()` matches recorded paths rather than origins, so HARs remain portable across `E2E_PORT` values.
5. Commit the resulting `.har`. Re-record when the API contract drifts; the bi-weekly cron does this automatically (see below).

### Wiring a HAR into a spec

**Body-aware journey replay (`harOverridesFor` helper).** Reads the HAR file and emits one `JsonOverride` per `(path, method, JSON-RPC method)` tuple, with `matchBody` fanning the JSON-RPC entry point out by request `method` field. Sequential entries that share a tuple replay in HAR order via the override's `callIndex` body function — so a `Workspace.ls` recorded twice (pre- and post-upload) replays correctly. Use this when the spec drives a signed-in journey (workspace listing, file viewer, jobs page, service form) and asserts on UI rendered from the recorded post-auth payloads.

```ts
import { harOverridesFor } from "../scripts/har-overrides";

await applyBackendMocks(page, {
  overrides: [
    // Endpoint-specific profile and mutation responses used by this journey.
    // Signed-in identity itself comes from the production-named cookies and
    // server-side profile validation.
    ...authSessionOverrides,
    ...harOverridesFor("workspace-browse.har"),
    // No fallback layered on top — not `emptyBackendFallbackOverrides`, not a
    // broad aggregate. `emptyBackendFallbackOverrides` answers `/api/workspace/`
    // with `{items: []}`, which is exactly the traffic this replay's strict-mode
    // canary watches; layering it here would turn a loud unmocked-request
    // failure (missing HAR coverage) into a silent empty-state timeout instead.
  ],
});

// Recorded paths key off the realm the recorder authenticated against (`bvbrc`),
// not the mocked-cookie realm (`patricbrc.org`). Match the recorded path so the
// workspace browser's outbound RPC calls land on the recorded entries; cookies
// just satisfy the middleware existence check.
await page.goto(`/workspace/${encodeURIComponent("e2e-test-user@bvbrc")}/home`);
```

`harOverridesFor` matches on `pathname + search`, so the host-placeholder rewrite (`http://e2e-har-replay.local`) is irrelevant; the override matcher does a substring `includes` check against the live request URL. Status and response headers are taken from the first entry of each group; if a journey needs status drift across same-key calls, layer hand-rolled overrides on top.

### Bi-weekly refresh

`.github/workflows/e2e-har-refresh.yml` runs the scripted recorders against the live backend on a fortnightly cron and opens a `chore(e2e): refresh recorded HARs` PR if any HAR diffed. Real shape changes (new fields, renamed keys, status drift) surface as a normal review; pure timestamp churn merges as-is. Required secrets: `E2E_TEST_USER`, `E2E_TEST_PASSWORD`, `E2E_HAR_REFRESH_TOKEN` (PAT with `contents:write` + `pull-requests:write`).

The workflow has two matrix groups:

- **read-only** (cron + manual dispatch): `workspace-browse`, `workspace-viewer`, `jobs-lifecycle`, `service-submit`. Nothing writes to the test account.
- **write** (manual dispatch with `include_write: true` only): `workspace-upload`. Each refresh creates a new file under `home/.e2e-records/` on the test account, so we keep this off the cron.

Each group opens its own PR (`chore/e2e-har-refresh-read-only` / `chore/e2e-har-refresh-write`). Some journeys depend on seeded fixtures on the test account — see [`e2e/scripts/journeys/README.md`](./scripts/journeys/README.md) for the catalogue and seeding requirements.

## Visual regression

Baselines live in `e2e/__snapshots__/`, one per `(spec, browser, platform)` triple. Chromium is strict (zero-pixel diff). Firefox and WebKit allow `maxDiffPixelRatio: 0.05` to absorb font/AA differences — which also means those two engines keep passing against a materially outdated baseline, so their images need refreshing deliberately rather than when a job goes red.

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

### A `pkg.version` bump reddens every full-page chromium snapshot

`next.config.ts` inlines `package.json`'s version as `NEXT_PUBLIC_APP_VERSION` and `src/components/navbars/desktop-navbar.tsx` renders it as a `v0.0.0` badge. The badge's glyph advance widths change with the digits, which shifts every navbar item to the left of the flex-grown search box by about a pixel — roughly 2100-2400 differing pixels on any `fullPage` snapshot, which chromium's zero tolerance rejects.

So a version bump alone turns the chromium visual job red for a change nobody made to the UI. That is expected, not a regression: refresh the baselines (`-darwin` locally, `-linux` from the failing CI run) as part of the bump. If this becomes tiresome, the fix is to pin `NEXT_PUBLIC_APP_VERSION` for the E2E build — masking the badge does not work, because the items to its right still shift when its intrinsic width changes.

### Adjudicating a drift: the failure's pixel count is not the region list

`toHaveScreenshot` counts pixels through pixelmatch at `threshold: 0.2`, which ignores differences below roughly a greyscale delta of 53. A change can therefore repaint most of the page and contribute **zero** to the reported count. When the `#ffffff` → `#f7f7f7` page background landed, it changed 636,261 px on `sign-in` and 557,125 px on `genome-assembly` — over half of each image — and Playwright reported 2450 and 3501 differing pixels, none of them the background.

When you adjudicate a drift, enumerate the regions from an **exact** byte comparison of baseline vs actual (a histogram of `oldColor -> newColor` transitions finds the sub-threshold ones immediately), not from the failure message. Treating the reported count as the region list is how a full-page repaint gets waved through as "a few pixels of text AA". The same trap is worse on firefox and webkit, whose `maxDiffPixelRatio: 0.05` hides perceptible changes too.

### Keep `-darwin` and `-linux` in step

Refreshing one platform and not the other leaves a baseline that disagrees with head on the platform you skipped, and — at chromium's zero tolerance — a red job for the next person. When a change requires new baselines, refresh **both** sets in the same PR: `-darwin` locally, `-linux` from that PR's failing CI run.

Two known cases where the sets currently disagree, both recorded so they are not rediscovered as mysteries:

- **`home`'s statistics tiles are pinned to values that are wrong on purpose.** The DB-statistics row reads `Virus Species 0`, `Taxons 0`, `Protein Structures 2` in every committed baseline, because `e2eDeterministicCounts.taxonomy` and `.protein_structure` in `src/app/api/e2e-mock/[...path]/route.ts` are unreachable — the named per-core branches in `maybeSolrCount` return first with `numFound: docs.length`. A fix to that fixture will change the rendered numbers, so it **must** refresh `home-chromium-darwin.png` and `home-chromium-linux.png` (and the webkit/firefox pair) together.
- **The firefox baselines are stale on both platforms.** They render a `v0.2.6` badge and a navbar whose first item is a since-removed "Getting started", and pass only because firefox allows `maxDiffPixelRatio: 0.05`. Firefox cannot be launched on the current dev Macs (`browserType.launch: Timeout 180000ms exceeded`, `sandbox_extension_issue_file_to_process … Operation not permitted`), so `-firefox-darwin` cannot be regenerated locally; both sets need a CI run.

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

**`tests/a11y/`** — the accessibility suite does not run under `playwright.config.ts` at all (`testMatch` excludes it). It has its own configs, scripts and gate; see `e2e/a11y/README.md` for the runbook.

**`viewer-3d.spec.ts`** — drives `/viewer/structure/<path>`, mocks `/api/workspace/view/...` with a minimal one-atom PDB, and asserts the page chrome + Mol* container render. The full WebGL canvas-paint assertion is gated on Mol*'s own runtime probe — if Mol* surfaces "WebGL does not seem to be available" (e.g. headless Chromium without GPU), the paint test self-skips. Firefox and WebKit are skipped wholesale because their headless WebGL stacks are unreliable.

**`search-keyboard.spec.ts`** — covers two complementary keyboard surfaces. The navbar `SearchBar` journey: type → Enter → routed to `/search?q=...&searchtype=everything`, empty submission stays put, clipboard paste fills the input (Chromium only; Firefox / WebKit headless clipboard permissions are unreliable). The global `<CommandPalette>` mounted in the root layout: `Cmd/Ctrl+K` opens the dialog, ArrowDown + Enter routes to a navigation item, typing a query + Enter routes to `/search`, Esc closes, and clipboard paste fills the palette input.

## When to add a Playwright test vs a Vitest test

- **Vitest** for: pure functions, hooks, contexts, API route handlers, components that render fine in jsdom.
- **Playwright** for: multi-page flows, real-cookie auth, file upload, drag/drop, 3D viewer, iframes, CSS/layout regressions, cross-browser parity.

If a single render-and-assert test would pass in jsdom, keep it in Vitest. Playwright is for journeys and browser-level truth.
