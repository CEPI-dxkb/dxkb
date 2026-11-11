// `server-only` throws outside Next's bundler, so this mock neutralizes the
// guard.
vi.mock("server-only", () => ({}));

import { cookies } from "next/headers";

import { setTestSession, testCookieStore } from "@/test-helpers/api-route-helpers";
import { DataApiError } from "../repository";
import type { DataApiRequest } from "../types";
import {
  anonymousMemberRevalidateSeconds,
  readScopeForOperation,
  resolveServerDataRepository,
  type DataApiReadScope,
} from "../server-policy";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}

const envVarNames = [
  "DATA_API_URL",
  "NEXT_PUBLIC_DATA_API",
  "E2E_MOCK_ENABLED",
] as const;
const originalEnv: Partial<Record<(typeof envVarNames)[number], string>> = {};

beforeEach(() => {
  for (const name of envVarNames) originalEnv[name] = process.env[name];
  delete process.env.DATA_API_URL;
  delete process.env.NEXT_PUBLIC_DATA_API;
  delete process.env.E2E_MOCK_ENABLED;
});

afterEach(() => {
  for (const name of envVarNames) {
    if (originalEnv[name] === undefined)
      Reflect.deleteProperty(process.env, name);
    else process.env[name] = originalEnv[name];
  }
});

const notConfiguredForTest = { message: "not configured for this test" };

async function resolve(
  readScope: DataApiReadScope,
  { anonymous }: { anonymous?: true } = {},
) {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));
  const resolved = await resolveServerDataRepository({
    readScope,
    notConfigured: notConfiguredForTest,
    anonymous,
    fetch: fetchMock,
  });
  await resolved.repository.member("genome", {
    operation: "member",
    id: "1.1",
  });
  return {
    sharedCache: resolved.sharedCache,
    init: fetchMock.mock.calls[0]?.[1],
    authorization: new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get(
      "Authorization",
    ),
  };
}

describe("readScopeForOperation", () => {
  it.each<[DataApiRequest["operation"], DataApiReadScope]>([
    ["member", "member"],
    ["collection", "query"],
    ["selected", "query"],
    ["export", "query"],
  ])("maps the %s operation to the %s read scope", (operation, expected) => {
    expect(readScopeForOperation(operation)).toBe(expected);
  });
});

describe("resolveServerDataRepository cache policy", () => {
  beforeEach(() => {
    process.env.DATA_API_URL = "https://data.example";
  });

  it("caches an anonymous member read and sends no token", async () => {
    const { sharedCache, init, authorization } = await resolve("member");

    expect(sharedCache).toBe(true);
    expect(init).toMatchObject({
      cache: "force-cache",
      next: { revalidate: anonymousMemberRevalidateSeconds },
    });
    expect(authorization).toBeNull();
  });

  it("does not cache an anonymous query read, even though it is anonymous", async () => {
    const { sharedCache, init, authorization } = await resolve("query");

    expect(sharedCache).toBe(false);
    expect(init).toMatchObject({ cache: "no-store", next: undefined });
    expect(authorization).toBeNull();
  });

  it.each<DataApiReadScope>(["member", "query"])(
    "bypasses cache and forwards the token for an authenticated %s read",
    async (readScope) => {
      setTestSession({ token: "secret-token" });

      const { sharedCache, init, authorization } = await resolve(readScope);

      expect(sharedCache).toBe(false);
      expect(init).toMatchObject({ cache: "no-store", next: undefined });
      expect(authorization).toBe("secret-token");
    },
  );

  it.each<DataApiReadScope>(["member", "query"])(
    "bypasses cache for an anonymous %s read during an E2E run",
    async (readScope) => {
      process.env.E2E_MOCK_ENABLED = "1";

      const { sharedCache, init, authorization } = await resolve(readScope);

      expect(sharedCache).toBe(false);
      expect(init).toMatchObject({ cache: "no-store", next: undefined });
      expect(authorization).toBeNull();
    },
  );

  it("treats any other E2E_MOCK_ENABLED value as not an E2E run", async () => {
    process.env.E2E_MOCK_ENABLED = "true";

    const { sharedCache } = await resolve("member");

    expect(sharedCache).toBe(true);
  });
});

describe("resolveServerDataRepository anonymous", () => {
  beforeEach(() => {
    process.env.DATA_API_URL = "https://data.example";
  });

  it("never reads the session and sends no token for a signed-in visitor", async () => {
    setTestSession({ token: "secret-token" });

    const { sharedCache, init, authorization } =
      await resolve("member", { anonymous: true });

    expect(cookies).not.toHaveBeenCalled();
    expect(authorization).toBeNull();
    expect(sharedCache).toBe(true);
    expect(init).toMatchObject({
      cache: "force-cache",
      next: { revalidate: anonymousMemberRevalidateSeconds },
    });
  });

  it("does not cache an anonymous query read", async () => {
    const { sharedCache, init } = await resolve("query", { anonymous: true });

    expect(sharedCache).toBe(false);
    expect(init).toMatchObject({ cache: "no-store", next: undefined });
  });

  it("does not cache an anonymous member read during an E2E run", async () => {
    process.env.E2E_MOCK_ENABLED = "1";

    const { sharedCache, init, authorization } =
      await resolve("member", { anonymous: true });

    expect(sharedCache).toBe(false);
    expect(init).toMatchObject({ cache: "no-store", next: undefined });
    expect(authorization).toBeNull();
  });

  it("still reports missing configuration first", async () => {
    delete process.env.DATA_API_URL;

    await expect(
      resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
        anonymous: true,
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(cookies).not.toHaveBeenCalled();
  });
});

describe("resolveServerDataRepository base URL resolution", () => {
  it.each(["", "   "])(
    "falls back to NEXT_PUBLIC_DATA_API when DATA_API_URL is %j",
    async (primary) => {
      process.env.DATA_API_URL = primary;
      process.env.NEXT_PUBLIC_DATA_API = "  https://public.example  ";
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));

      const { repository } = await resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
        fetch: fetchMock,
      });
      await repository.member("genome", { operation: "member", id: "1.1" });

      const [requested] = fetchMock.mock.calls[0] ?? [];
      expect(requested instanceof URL ? requested.origin : requested).toBe(
        "https://public.example",
      );
    },
  );

  it("prefers and trims DATA_API_URL when both are set", async () => {
    process.env.DATA_API_URL = "  https://preferred.example  ";
    process.env.NEXT_PUBLIC_DATA_API = "https://fallback.example";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));

    const { repository } = await resolveServerDataRepository({
      readScope: "member",
      notConfigured: notConfiguredForTest,
      fetch: fetchMock,
    });
    await repository.member("genome", { operation: "member", id: "1.1" });

    const [requested] = fetchMock.mock.calls[0] ?? [];
    expect(requested instanceof URL ? requested.origin : requested).toBe(
      "https://preferred.example",
    );
  });
});

describe("resolveServerDataRepository missing configuration", () => {
  it("treats empty primary and fallback values as missing", async () => {
    process.env.DATA_API_URL = " ";
    process.env.NEXT_PUBLIC_DATA_API = "\t";

    await expect(
      resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("throws the caller's message with the 500/not_configured discriminator", async () => {
    const rejection = resolveServerDataRepository({
      readScope: "member",
      notConfigured: { message: "The caller's own wording." },
    });

    await expect(rejection).rejects.toBeInstanceOf(DataApiError);
    await expect(rejection).rejects.toMatchObject({
      message: "The caller's own wording.",
      status: 500,
      code: "not_configured",
    });
  });

  it("logs the caller's operator-facing line without putting it in the error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const rejection = resolveServerDataRepository({
      readScope: "member",
      notConfigured: {
        message: "Sanitized for the client.",
        log: "Some route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
      },
    });

    await expect(rejection).rejects.toMatchObject({
      message: "Sanitized for the client.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Some route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
  });

  it("logs nothing when the caller omits an operator-facing line", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
      }),
    ).rejects.toBeInstanceOf(DataApiError);

    expect(consoleError).not.toHaveBeenCalled();
  });

  // The base-URL check precedes `readSession()`: with both failing, the
  // configuration error must be the one reported.
  it("reports missing configuration before attempting a session lookup", async () => {
    testCookieStore.get.mockImplementation(() => {
      throw new Error("Cookie store unavailable in this rendering mode");
    });

    await expect(
      resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(testCookieStore.get).not.toHaveBeenCalled();
  });

  // A cookie-store failure with valid configuration must propagate untouched;
  // `protein-structure-view/server.ts` depends on this.
  it("propagates a session lookup failure instead of relabeling it", async () => {
    process.env.DATA_API_URL = "https://data.example";
    const cookieStoreError = new Error(
      "Cookie store unavailable in this rendering mode",
    );
    testCookieStore.get.mockImplementation(() => {
      throw cookieStoreError;
    });

    await expect(
      resolveServerDataRepository({
        readScope: "member",
        notConfigured: notConfiguredForTest,
      }),
    ).rejects.toThrow(cookieStoreError);
  });
});
