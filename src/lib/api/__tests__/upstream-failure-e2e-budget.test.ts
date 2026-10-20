import { fetchUpstream, UpstreamError } from "../upstream-failure";

const service = "the BV-BRC data service";

/** A backend that accepts the request and answers only when aborted. */
function hangingFetch(
  _input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(init.signal?.reason as Error);
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("fetchUpstream's e2e budget cap", () => {
  it("ends a hang after E2E_UPSTREAM_BUDGET_MS in the e2e harness, naming the production budget", async () => {
    vi.stubEnv("E2E_MOCK_ENABLED", "1");
    vi.stubEnv("E2E_UPSTREAM_BUDGET_MS", "20");

    const failure = await fetchUpstream(
      "http://127.0.0.1:3020/api/e2e-mock/data/genome/",
      {},
      { service, timeoutMs: 20_000, fetcher: hangingFetch },
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UpstreamError);
    expect(failure).toMatchObject({
      status: 504,
      code: "upstream_timeout",
      message: expect.stringContaining("timed out after 20 s") as unknown,
    });
  });

  it.each([
    ["the mock is off", undefined, "20"],
    ["the cap is not a positive number", "1", "soon"],
    ["the cap is above the budget", "1", "90000"],
  ])("keeps the production budget when %s", async (_case, enabled, cap) => {
    vi.stubEnv("E2E_MOCK_ENABLED", enabled);
    vi.stubEnv("E2E_UPSTREAM_BUDGET_MS", cap);
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await fetchUpstream(
      "https://example.org/",
      {},
      {
        service,
        timeoutMs: 20_000,
        fetcher: () => Promise.resolve(new Response("ok")),
      },
    );

    expect(timeout).toHaveBeenCalledWith(20_000);
  });
});
