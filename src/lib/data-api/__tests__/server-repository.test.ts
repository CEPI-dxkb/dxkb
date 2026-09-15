// `server-only` throws unconditionally outside Next's bundler (it relies on a
// webpack alias swap that only exists in the real build); every test file
// that imports a module gated by it neutralizes the guard the same way
// `src/lib/phylogeny/__tests__/dataset-store.test.ts` does.
vi.mock("server-only", () => ({}));

import { http } from "msw";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { DataApiError } from "../repository";
import { createServerDataRepository } from "../server-repository";

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const envVarNames = ["DATA_API_URL", "NEXT_PUBLIC_DATA_API", "E2E_MOCK_ENABLED"] as const;
const originalEnv: Partial<Record<(typeof envVarNames)[number], string>> = {};

beforeEach(() => {
  for (const name of envVarNames) originalEnv[name] = process.env[name];
  delete process.env.DATA_API_URL;
  delete process.env.NEXT_PUBLIC_DATA_API;
  delete process.env.E2E_MOCK_ENABLED;
});

afterEach(() => {
  for (const name of envVarNames) {
    if (originalEnv[name] === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = originalEnv[name];
  }
});

describe("createServerDataRepository", () => {
  it("throws a DataApiError with a not_configured code when neither env var is set", async () => {
    const rejection = createServerDataRepository();
    await expect(rejection).rejects.toBeInstanceOf(DataApiError);
    await expect(rejection).rejects.toMatchObject({
      message: "DATA_API_URL is not configured.",
      status: 500,
      code: "not_configured",
    });
  });

  it("falls back to NEXT_PUBLIC_DATA_API when DATA_API_URL is unset", async () => {
    process.env.NEXT_PUBLIC_DATA_API = "https://public.example";
    server.use(
      http.get("https://public.example/genome/", () =>
        jsonResponse([{ genome_id: "1.1" }]),
      ),
    );

    const repository = await createServerDataRepository();

    await expect(
      repository.member("genome", { operation: "member", id: "1.1" }),
    ).resolves.toEqual({ row: { genome_id: "1.1" } });
  });

  it("prefers DATA_API_URL over NEXT_PUBLIC_DATA_API when both are set", async () => {
    process.env.DATA_API_URL = "https://preferred.example";
    process.env.NEXT_PUBLIC_DATA_API = "https://fallback.example";
    server.use(
      http.get("https://preferred.example/genome/", () =>
        jsonResponse([{ genome_id: "1.1" }]),
      ),
    );

    const repository = await createServerDataRepository();

    await expect(
      repository.member("genome", { operation: "member", id: "1.1" }),
    ).resolves.toEqual({ row: { genome_id: "1.1" } });
  });

  it("caches anonymous requests with a 300-second revalidation window and no token", async () => {
    process.env.DATA_API_URL = "https://data.example";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));

    const repository = await createServerDataRepository({ fetch: fetchMock });
    await repository.member("genome", { operation: "member", id: "1.1" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ cache: "force-cache", next: { revalidate: 300 } }),
    );
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("bypasses cache and forwards the session token for authenticated requests", async () => {
    process.env.DATA_API_URL = "https://data.example";
    setTestSession({ token: "secret-token" });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));

    const repository = await createServerDataRepository({ fetch: fetchMock });
    await repository.member("genome", { operation: "member", id: "1.1" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ cache: "no-store", next: undefined }),
    );
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("secret-token");
  });

  it("bypasses cache for E2E mock runs even without a session", async () => {
    process.env.DATA_API_URL = "https://data.example";
    process.env.E2E_MOCK_ENABLED = "1";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));

    const repository = await createServerDataRepository({ fetch: fetchMock });
    await repository.member("genome", { operation: "member", id: "1.1" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ cache: "no-store", next: undefined }),
    );
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  // HTTPS enforcement itself is `ServerDataRepository`'s own concern, fully
  // covered by the "requires HTTPS and disables redirects for authenticated
  // requests" case in `repository.test.ts`. This test only proves the factory
  // wiring — env resolution feeding straight into the repository's own
  // check — doesn't accidentally bypass it for an authenticated caller.
  it("still enforces HTTPS for authenticated requests once assembled by the factory", async () => {
    process.env.DATA_API_URL = "http://insecure.example";
    setTestSession({ token: "secret-token" });

    const repository = await createServerDataRepository();

    await expect(
      repository.member("genome", { operation: "member", id: "1.1" }),
    ).rejects.toThrow(/HTTPS/);
  });
});
