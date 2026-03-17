# Vitest Mock Audit & Standardization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all unit tests for correct Vitest mocking patterns: hoisting violations, fetch stubbing, cleanup lifecycle, and MSW migration.

**Architecture:** Four sequential phases — each phase is a commit. Phases 1-3 are mechanical find-and-replace fixes. Phase 4 installs MSW and migrates ~29 fetch-stubbing tests to use network-level interception instead of `vi.stubGlobal("fetch")`.

**Tech Stack:** Vitest 4, `vi.hoisted()`, `vi.stubGlobal()`, MSW (`msw` package, `setupServer` from `msw/node`)

**Spec:** `docs/superpowers/specs/2026-03-17-vitest-mock-audit-design.md`

---

## Chunk 1: Phases 1–3 (Correctness Fixes)

### Task 1: Convert hoisting violations to `vi.hoisted()` (11 files)

**Files:**
- Modify: `src/contexts/__tests__/auth-context.test.tsx:1-10`
- Modify: `src/hooks/__tests__/use-auth-styles.test.tsx:1-15`
- Modify: `src/hooks/__tests__/use-authenticated-fetch-client.test.tsx:1-8`
- Modify: `src/hooks/services/jobs/__tests__/use-job-detail.test.tsx:1-8`
- Modify: `src/hooks/services/jobs/__tests__/use-jobs-data.test.tsx:1-8`
- Modify: `src/hooks/services/jobs/__tests__/use-jobs-summary.test.tsx:1-8`
- Modify: `src/hooks/services/workspace/__tests__/use-workspace.test.tsx:1-9`
- Modify: `src/hooks/services/workspace/__tests__/use-workspace-action-dispatch.test.tsx:1-10`
- Modify: `src/hooks/services/workspace/__tests__/use-workspace-dialog-handlers.test.tsx:1-27`
- Modify: `src/lib/__tests__/auth.test.ts:1-8`
- Modify: `src/app/api/auth/__tests__/utils.test.ts:1-8`

- [ ] **Step 1: Fix `auth-context.test.tsx`**

Replace lines 4-10:

```tsx
// BEFORE
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ replace: mockReplace, push: vi.fn() })),
  useSearchParams: vi.fn(() => ({ toString: () => "" })),
}));

// AFTER
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({ replace: mockReplace, push: vi.fn() })),
  useSearchParams: vi.fn(() => ({ toString: () => "" })),
}));
```

- [ ] **Step 2: Fix `use-auth-styles.test.tsx`**

Replace lines 4-7 and update the `beforeEach` and all test bodies to mutate instead of reassign:

```tsx
// BEFORE
let mockAuth = { isAuthenticated: false, isLoading: false };
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));
// ... throughout file:
// beforeEach(() => { mockAuth = { ... }; });
// In tests: mockAuth = { isAuthenticated: true, isLoading: false };

// AFTER
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { isAuthenticated: false, isLoading: false },
}));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => mockAuth,
}));
// ... throughout file:
// beforeEach:
//   mockAuth.isAuthenticated = false;
//   mockAuth.isLoading = false;
// In tests: Object.assign(mockAuth, { isAuthenticated: true, isLoading: false });
```

Every `mockAuth = { ... }` reassignment in the file must become `Object.assign(mockAuth, { ... })` or individual property mutations. There are ~8 occurrences.

- [ ] **Step 3: Fix `use-authenticated-fetch-client.test.tsx`**

Replace lines 4-8:

```tsx
// BEFORE
const mockRefreshAuth = vi.fn();

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));

// AFTER
const { mockRefreshAuth } = vi.hoisted(() => ({ mockRefreshAuth: vi.fn() }));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ refreshAuth: mockRefreshAuth }),
}));
```

- [ ] **Step 4: Fix `use-job-detail.test.tsx`**

Replace lines 5-8:

```tsx
// BEFORE
const mockFetch = vi.fn();
vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));

// AFTER
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));
```

- [ ] **Step 5: Fix `use-jobs-data.test.tsx`**

Same pattern as Step 4 — replace lines 5-8 with `vi.hoisted`.

- [ ] **Step 6: Fix `use-jobs-summary.test.tsx`**

Same pattern as Step 4 — replace lines 5-8 with `vi.hoisted`.

- [ ] **Step 7: Fix `use-workspace.test.tsx`**

Replace lines 5-9:

```tsx
// BEFORE
const mockFetch = vi.fn();

vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));

// AFTER
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: () => mockFetch,
}));
```

- [ ] **Step 8: Fix `use-workspace-action-dispatch.test.tsx`**

Replace lines 7-10:

```tsx
// BEFORE
const mockDispatch = vi.fn();
vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({ dispatch: mockDispatch }),
}));

// AFTER
const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));
vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({ dispatch: mockDispatch }),
}));
```

- [ ] **Step 9: Fix `use-workspace-dialog-handlers.test.tsx`**

Replace lines 15-27:

```tsx
// BEFORE
const mockDispatch = vi.fn();
let mockActiveDialog: unknown = null;

vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({
    dispatch: mockDispatch,
    state: {
      get activeDialog() {
        return mockActiveDialog;
      },
    },
  }),
}));

// AFTER
const { mockDispatch, mockActiveDialog } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockActiveDialog: { value: null as unknown },
}));

vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({
    dispatch: mockDispatch,
    state: {
      get activeDialog() {
        return mockActiveDialog.value;
      },
    },
  }),
}));
```

Then update all `mockActiveDialog = ...` reassignments in the file to `mockActiveDialog.value = ...`. Also update the `beforeEach` to set `mockActiveDialog.value = null`.

- [ ] **Step 10: Fix `auth.test.ts`**

Replace lines 1-8:

```ts
// BEFORE
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// AFTER
const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));
```

- [ ] **Step 11: Fix `utils.test.ts` (auth)**

Replace lines 1-8. Same pattern as Step 10.

- [ ] **Step 12: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/contexts/__tests__/auth-context.test.tsx \
  src/hooks/__tests__/use-auth-styles.test.tsx \
  src/hooks/__tests__/use-authenticated-fetch-client.test.tsx \
  src/hooks/services/jobs/__tests__/use-job-detail.test.tsx \
  src/hooks/services/jobs/__tests__/use-jobs-data.test.tsx \
  src/hooks/services/jobs/__tests__/use-jobs-summary.test.tsx \
  src/hooks/services/workspace/__tests__/use-workspace.test.tsx \
  src/hooks/services/workspace/__tests__/use-workspace-action-dispatch.test.tsx \
  src/hooks/services/workspace/__tests__/use-workspace-dialog-handlers.test.tsx \
  src/lib/__tests__/auth.test.ts \
  src/app/api/auth/__tests__/utils.test.ts
git commit -m "fix(tests): convert vi.mock hoisting violations to vi.hoisted()"
```

---

### Task 2: Standardize fetch mocking to `vi.stubGlobal()` (4 files)

**Files:**
- Modify: `src/lib/services/__tests__/genome.test.ts` (~30 occurrences)
- Modify: `src/lib/__tests__/auth.test.ts:66`
- Modify: `src/app/api/auth/__tests__/utils.test.ts:61,111`
- Modify: `src/hooks/__tests__/use-authenticated-fetch-client.test.tsx:11-19`

- [ ] **Step 1: Fix `genome.test.ts`**

Replace every `global.fetch = mockFetchResponse(...)` with `vi.stubGlobal("fetch", mockFetchResponse(...))` and every `global.fetch = vi.fn()...` with `vi.stubGlobal("fetch", vi.fn()...)`.

Use find-and-replace: `global.fetch = ` → `vi.stubGlobal("fetch", ` then fix the line endings to add `)`.

Pattern:
```ts
// BEFORE
global.fetch = mockFetchResponse({ results: mockResults });

// AFTER
vi.stubGlobal("fetch", mockFetchResponse({ results: mockResults }));
```

Also replace any `expect(global.fetch)` with `expect(globalThis.fetch)` since `vi.stubGlobal` sets on `globalThis`.

- [ ] **Step 2: Fix `auth.test.ts`**

Replace line 66:

```ts
// BEFORE
global.fetch = mockFetch;

// AFTER
vi.stubGlobal("fetch", mockFetch);
```

- [ ] **Step 3: Fix `utils.test.ts` (auth)**

Replace lines 61 and ~111 (two `describe` blocks that each have `global.fetch = mockFetch`):

```ts
// BEFORE
global.fetch = mockFetch;

// AFTER
vi.stubGlobal("fetch", mockFetch);
```

- [ ] **Step 4: Fix `use-authenticated-fetch-client.test.tsx`**

Replace the manual save/restore pattern (lines 11-19):

```tsx
// BEFORE
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// AFTER
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

Remove the `const originalFetch = globalThis.fetch;` line entirely.

Also update any `vi.mocked(globalThis.fetch)` references — these should still work since `vi.stubGlobal` sets on `globalThis`.

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/__tests__/genome.test.ts \
  src/lib/__tests__/auth.test.ts \
  src/app/api/auth/__tests__/utils.test.ts \
  src/hooks/__tests__/use-authenticated-fetch-client.test.tsx
git commit -m "fix(tests): standardize fetch mocking to vi.stubGlobal()"
```

---

### Task 3: Fix cleanup lifecycle (3 files)

**Files:**
- Modify: `src/lib/services/__tests__/genome.test.ts:20-22`
- Modify: `src/lib/services/__tests__/service-utils.test.ts:6-8`
- Modify: `src/lib/services/__tests__/feature.test.ts:6-8`

- [ ] **Step 1: Fix `genome.test.ts`**

Replace lines 20-22:

```ts
// BEFORE
beforeEach(() => {
  vi.restoreAllMocks();
});

// AFTER
afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: Fix `service-utils.test.ts`**

Replace lines 6-8:

```ts
// BEFORE
afterEach(() => {
  vi.resetAllMocks();
});

// AFTER
afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Fix `feature.test.ts`**

Replace lines 6-8:

```ts
// BEFORE
afterEach(() => {
  vi.resetAllMocks();
});

// AFTER
afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/__tests__/genome.test.ts \
  src/lib/services/__tests__/service-utils.test.ts \
  src/lib/services/__tests__/feature.test.ts
git commit -m "fix(tests): correct cleanup lifecycle (afterEach + restoreAllMocks)"
```

---

## Chunk 2: Phase 4a — MSW Setup

### Task 4: Install MSW and create test infrastructure

**Files:**
- Create: `src/test-helpers/msw-server.ts`
- Create: `src/test-helpers/msw-handlers.ts`
- Modify: `vitest.setup.ts`
- Modify: `package.json` (via pnpm add)

- [ ] **Step 1: Install MSW**

Run: `pnpm add -D msw`
Expected: `msw` added to `devDependencies` in `package.json`.

- [ ] **Step 2: Create `src/test-helpers/msw-server.ts`**

```ts
import { setupServer } from "msw/node";

export const server = setupServer();
```

- [ ] **Step 3: Create `src/test-helpers/msw-handlers.ts`**

```ts
import { http, HttpResponse } from "msw";

/**
 * Creates an MSW handler for a JSON-RPC POST endpoint.
 * Matches on the `method` field in the request body.
 */
export function jsonRpcHandler(
  url: string,
  method: string,
  result: unknown,
  id?: number,
) {
  return http.post(url, async ({ request }) => {
    const body = (await request.json()) as { method: string; id: number };
    if (body.method !== method) {
      return HttpResponse.json(
        { error: { message: `unexpected method: ${body.method}` } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ result: [result], id: id ?? body.id });
  });
}

/** Creates an MSW GET handler returning JSON. */
export function mockGetEndpoint(
  url: string,
  data: unknown,
  status = 200,
) {
  return http.get(url, () => HttpResponse.json(data, { status }));
}

/** Creates an MSW POST handler returning JSON. */
export function mockPostEndpoint(
  url: string,
  data: unknown,
  status = 200,
) {
  return http.post(url, () => HttpResponse.json(data, { status }));
}

/** Creates an MSW handler that returns an error response. */
export function mockErrorEndpoint(
  url: string,
  method: "get" | "post",
  status: number,
  body?: unknown,
) {
  const handler = method === "get" ? http.get : http.post;
  return handler(url, () =>
    HttpResponse.json(body ?? { error: "error" }, { status }),
  );
}
```

- [ ] **Step 4: Add MSW lifecycle to `vitest.setup.ts`**

Add at the end of the existing file:

```ts
import { server } from "@/test-helpers/msw-server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 5: Verify MSW doesn't break existing tests**

Run: `pnpm test`
Expected: All tests pass. The MSW server with `"warn"` mode is inert when no handlers are registered — existing `vi.stubGlobal("fetch")` tests should be unaffected.

- [ ] **Step 6: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/test-helpers/msw-server.ts \
  src/test-helpers/msw-handlers.ts \
  vitest.setup.ts \
  package.json \
  pnpm-lock.yaml
git commit -m "feat(tests): add MSW test infrastructure"
```

---

## Chunk 3: Phase 4b — Migrate Library/Utility Tests (11 files)

### Task 5: Migrate library/utility tests to MSW

Each file follows the same migration pattern:
1. Remove `vi.stubGlobal("fetch", mockFetch)` and `const mockFetch = vi.fn()` (module-level or in `beforeEach`)
2. Remove `vi.restoreAllMocks()` / `vi.resetAllMocks()` in `afterEach` that were only for fetch cleanup (MSW handles this via `server.resetHandlers()` in `vitest.setup.ts`)
3. Import `{ http, HttpResponse }` from `msw` and `{ server }` from `@/test-helpers/msw-server`
4. Replace each `mockFetch.mockResolvedValue(...)` in tests with `server.use(http.get/post(...))` handlers
5. Replace `expect(mockFetch).toHaveBeenCalledWith(...)` assertions with inline assertions inside the MSW handler or structural assertions on the result

**Files:**
- Modify: `src/lib/__tests__/jsonrpc-client.test.ts`
- Modify: `src/lib/__tests__/auth.test.ts`
- Modify: `src/lib/__tests__/auth-client.test.ts`
- Modify: `src/lib/__tests__/app-service.test.ts`
- Modify: `src/lib/services/__tests__/service-utils.test.ts`
- Modify: `src/lib/services/__tests__/genome.test.ts`
- Modify: `src/lib/services/__tests__/feature.test.ts`
- Modify: `src/lib/services/workspace/__tests__/server.test.ts`
- Modify: `src/lib/services/workspace/__tests__/client.test.ts`
- Modify: `src/lib/services/workspace/__tests__/validation.test.ts`
- Modify: `src/hooks/__tests__/use-authenticated-fetch-client.test.tsx`

**Important:** Before modifying each file, read it fully to understand the current test structure. Many of these files test different functions that call different endpoints — each test case needs its own MSW handler.

- [ ] **Step 1: Read the source files being tested**

Before migrating each test file, read the corresponding source file to understand:
- What URL each function constructs
- What HTTP method is used (GET vs POST)
- What headers are sent
- What the request body looks like
- What the response format is

Key source files:
- `src/lib/jsonrpc-client.ts` — JSON-RPC POST to `getRequiredEnv("APP_SERVICE_URL")`
- `src/lib/auth.ts` — `serverAuthenticatedFetch` wraps `fetch` with auth header
- `src/lib/auth-client.ts` — client-side auth functions calling `/api/auth/*`
- `src/lib/app-service.ts` — fetches job output from `APP_SERVICE_URL`
- `src/lib/services/service-utils.ts` — `submitServiceJob` POSTs to `/api/services/app-service/submit`
- `src/lib/services/genome.ts` — various GET/POST to `/api/services/genome/*`
- `src/lib/services/feature.ts` — POST to `/api/services/feature/from-group`
- `src/lib/services/workspace/client.ts` — JSON-RPC POST to `/api/services/workspace`
- `src/lib/services/workspace/server.ts` — server-side workspace calls
- `src/lib/services/workspace/validation.ts` — workspace path validation
- `src/hooks/use-authenticated-fetch-client.ts` — fetch wrapper with 401 retry

- [ ] **Step 2: Migrate `jsonrpc-client.test.ts`**

This file tests JSON-RPC calls. The `JsonRpcClient` POSTs to a configurable URL. Use the `jsonRpcHandler` factory from `msw-handlers.ts` where possible, or custom `http.post()` handlers for error/edge cases.

Pattern for each test:
```ts
// Replace mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: [...] }) })
// with:
server.use(
  http.post("https://test-url/endpoint", async ({ request }) => {
    const body = await request.json();
    // assertions on body.method, body.params, etc.
    return HttpResponse.json({ result: [...], id: body.id });
  }),
);
```

For error tests (network errors, non-ok responses):
```ts
server.use(
  http.post("https://test-url/endpoint", () => {
    return HttpResponse.json({ error: "not found" }, { status: 404 });
  }),
);

// For network errors:
server.use(
  http.post("https://test-url/endpoint", () => {
    return HttpResponse.error();
  }),
);
```

- [ ] **Step 3: Migrate `auth.test.ts`**

The `serverAuthenticatedFetch` function wraps `fetch` with an Authorization header. Test that:
- The auth header is correctly added (use handler to inspect `request.headers`)
- Requests without auth still work

Note: `mockCookieStore` (from Phase 1's `vi.hoisted`) is still needed for cookie mocking — only the fetch mock changes.

- [ ] **Step 4: Migrate `auth-client.test.ts`**

Client-side auth functions call `/api/auth/*` endpoints. Each function has its own endpoint. Set up handlers per-test using `server.use()`.

- [ ] **Step 5: Migrate `app-service.test.ts`**

Tests job output fetching from `APP_SERVICE_URL`. Handlers match `http.get("*/task_info/*")`.

- [ ] **Step 6: Migrate `service-utils.test.ts`**

Tests `submitServiceJob` which POSTs to `/api/services/app-service/submit`. Single endpoint, multiple response scenarios.

- [ ] **Step 7: Migrate `genome.test.ts`**

This is the largest file (~30 fetch mocks). Multiple functions with different endpoints:
- `fetchGenomeSuggestions` → GET `/api/services/genome/search?q=...&limit=...`
- `fetchGenomesByIds` → POST `/api/services/genome/by-ids`
- `fetchAllGenomeIds` → POST `/api/services/genome/get-all-ids`
- `validateViralGenomes` → POST `/api/services/genome/validate-viral`
- `getGenomeIdsFromGroup` → POST `/api/services/workspace` (JSON-RPC)
- `fetchGenomeGroupMembers` → POST `/api/services/genome/by-ids` (chained with workspace)

Each `describe` block needs its own handler setup.

- [ ] **Step 8: Migrate `feature.test.ts`**

Tests `fetchFeaturesFromGroup` which POSTs to `/api/services/feature/from-group`.

- [ ] **Step 9: Migrate workspace tests (`server.test.ts`, `client.test.ts`, `validation.test.ts`)**

All use JSON-RPC over POST. The `client.test.ts` tests `WorkspaceApiClient.makeRequest` which POSTs to `/api/services/workspace`. The `server.test.ts` calls the same endpoint server-side with a mocked env var URL. Use `jsonRpcHandler` where the happy path applies; use custom handlers for error cases.

- [ ] **Step 10: Migrate `use-authenticated-fetch-client.test.tsx`**

This hook test wraps `fetch` with credentials and 401 retry logic. Use MSW handlers to:
- Return 200 for normal requests
- Return 401 then 200 for retry flow testing
- Return network errors for error handling tests

- [ ] **Step 11: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 12: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors.

- [ ] **Step 13: Commit**

```bash
git add src/lib/__tests__/jsonrpc-client.test.ts \
  src/lib/__tests__/auth.test.ts \
  src/lib/__tests__/auth-client.test.ts \
  src/lib/__tests__/app-service.test.ts \
  src/lib/services/__tests__/service-utils.test.ts \
  src/lib/services/__tests__/genome.test.ts \
  src/lib/services/__tests__/feature.test.ts \
  src/lib/services/workspace/__tests__/server.test.ts \
  src/lib/services/workspace/__tests__/client.test.ts \
  src/lib/services/workspace/__tests__/validation.test.ts \
  src/hooks/__tests__/use-authenticated-fetch-client.test.tsx
git commit -m "refactor(tests): migrate library/utility tests to MSW"
```

---

## Chunk 4: Phase 4c-4e — Migrate Route Tests & Finalize

### Task 6: Migrate auth API route tests to MSW (7 files)

**Files:**
- Modify: `src/app/api/auth/sign-in/email/__tests__/route.test.ts`
- Modify: `src/app/api/auth/sign-up/email/__tests__/route.test.ts`
- Modify: `src/app/api/auth/get-session/__tests__/route.test.ts`
- Modify: `src/app/api/auth/forget-password/__tests__/route.test.ts`
- Modify: `src/app/api/auth/verify-email-token/__tests__/route.test.ts`
- Modify: `src/app/api/auth/send-verification-email/__tests__/route.test.ts`
- Modify: `src/app/api/auth/__tests__/utils.test.ts`

**Important:** These route tests mock `getRequiredEnv` to return a known URL (e.g., `"http://mock-url"`). The MSW handler URLs must match what the source code constructs using that mocked env var. Read each route's source to determine the exact URL pattern.

- [ ] **Step 1: Read each auth route's source code**

Understand the URL each route constructs:
- `src/app/api/auth/sign-in/email/route.ts`
- `src/app/api/auth/sign-up/email/route.ts`
- `src/app/api/auth/get-session/route.ts`
- `src/app/api/auth/forget-password/route.ts`
- `src/app/api/auth/verify-email-token/route.ts`
- `src/app/api/auth/send-verification-email/route.ts`
- `src/app/api/auth/utils.ts` (for `getProfileMetadata`, `getUserEmailByUsername`)

- [ ] **Step 2: Migrate each auth route test file**

For each file:
1. Remove `const mockFetch = vi.fn()` and `vi.stubGlobal("fetch", mockFetch)`
2. Remove fetch-related cleanup in `afterEach` (keep other cleanup like `vi.clearAllMocks()`)
3. Add `import { http, HttpResponse } from "msw"` and `import { server } from "@/test-helpers/msw-server"`
4. In each test, replace `mockFetch.mockResolvedValue(...)` with `server.use(http.post/get(...))`
5. Keep `vi.mock("@/lib/env", ...)` and `vi.mock("next/headers", ...)` — only the fetch mock changes

The `utils.test.ts` file has two sections (`getProfileMetadata` and `getUserEmailByUsername`) that each set up their own `mockFetch`. Both need migration.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/sign-in/email/__tests__/route.test.ts \
  src/app/api/auth/sign-up/email/__tests__/route.test.ts \
  src/app/api/auth/get-session/__tests__/route.test.ts \
  src/app/api/auth/forget-password/__tests__/route.test.ts \
  src/app/api/auth/verify-email-token/__tests__/route.test.ts \
  src/app/api/auth/send-verification-email/__tests__/route.test.ts \
  src/app/api/auth/__tests__/utils.test.ts
git commit -m "refactor(tests): migrate auth route tests to MSW"
```

---

### Task 7: Migrate service API route tests to MSW (11 files)

**Files:**
- Modify: `src/app/api/services/genome/search/__tests__/route.test.ts`
- Modify: `src/app/api/services/genome/by-ids/__tests__/route.test.ts`
- Modify: `src/app/api/services/genome/get-all-ids/__tests__/route.test.ts`
- Modify: `src/app/api/services/genome/validate-viral/__tests__/route.test.ts`
- Modify: `src/app/api/services/genome/website-query/__tests__/route.test.ts`
- Modify: `src/app/api/services/feature/from-group/__tests__/route.test.ts`
- Modify: `src/app/api/services/taxonomy/__tests__/route.test.ts`
- Modify: `src/app/api/services/sra-validation/__tests__/route.test.ts`
- Modify: `src/app/api/services/minhash/__tests__/route.test.ts`
- Modify: `src/app/api/services/workspace/__tests__/route.test.ts`
- Modify: `src/app/api/services/workspace/upload/__tests__/route.test.ts`

**Important:** These route tests are proxy-style — the Next.js route handler receives a `NextRequest`, then calls the backend service via `fetch`. The MSW handler should intercept the backend call (the URL from `getRequiredEnv("APP_SERVICE_URL")`), not the incoming Next.js request.

- [ ] **Step 1: Read each service route's source code**

Understand the backend URL each route constructs. Most follow a pattern:
```ts
const url = `${getRequiredEnv("APP_SERVICE_URL")}/some/path`;
const res = await fetch(url, { ... });
```

- [ ] **Step 2: Migrate each service route test file**

Same migration pattern as Task 6. These routes typically mock:
- `getRequiredEnv` → returns `"http://mock-url"` — keep this
- `getBvbrcAuthToken` → returns a token string — keep this
- `fetch` → stubbed globally — **replace with MSW**

For the workspace route test, which has JSON-RPC calls, use the `jsonRpcHandler` factory.

For the workspace upload route test, which handles multipart uploads, the MSW handler needs to handle the `FormData` body.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Run lint and build**

Run: `pnpm lint && pnpm build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/services/genome/search/__tests__/route.test.ts \
  src/app/api/services/genome/by-ids/__tests__/route.test.ts \
  src/app/api/services/genome/get-all-ids/__tests__/route.test.ts \
  src/app/api/services/genome/validate-viral/__tests__/route.test.ts \
  src/app/api/services/genome/website-query/__tests__/route.test.ts \
  src/app/api/services/feature/from-group/__tests__/route.test.ts \
  src/app/api/services/taxonomy/__tests__/route.test.ts \
  src/app/api/services/sra-validation/__tests__/route.test.ts \
  src/app/api/services/minhash/__tests__/route.test.ts \
  src/app/api/services/workspace/__tests__/route.test.ts \
  src/app/api/services/workspace/upload/__tests__/route.test.ts
git commit -m "refactor(tests): migrate service route tests to MSW"
```

---

### Task 8: Switch `onUnhandledRequest` to `"error"` and clean up

**Files:**
- Modify: `vitest.setup.ts`
- Modify: `src/test-helpers/api-route-helpers.ts` (remove `mockFetchResponse` if no longer used)

- [ ] **Step 1: Update `vitest.setup.ts`**

Change the MSW `listen` call:

```ts
// BEFORE
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// AFTER
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
```

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass. If any test fails with "unhandled request", it means a fetch call was missed during migration — fix by adding the appropriate MSW handler.

- [ ] **Step 3: Check for unused helpers**

Check if `mockFetchResponse` in `src/test-helpers/api-route-helpers.ts` is still used by any test. If not, remove it.

Run: Search for `mockFetchResponse` across all test files.

- [ ] **Step 4: Run full verification**

Run: `pnpm lint && pnpm build && pnpm test`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add vitest.setup.ts src/test-helpers/api-route-helpers.ts
git commit -m "refactor(tests): switch MSW to strict mode (onUnhandledRequest: error)"
```
