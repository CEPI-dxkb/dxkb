import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  connectTimeout,
  maintenancePage,
  neverRespond,
} from "@/test-helpers/upstream-failures";

import { authenticate, getProfile, updateProfile } from "../bvbrc-identity";

const secrets = ["alice", "s3cret-password", "un=alice|tok-123", "Site Maintenance"];

/** This module's lines; MSW also reports a handler's thrown error there. */
function loggedLines(): string[] {
  return vi
    .mocked(console.error)
    .mock.calls.map((call) => call.map(String).join(" "))
    .filter((line) => line.startsWith("[auth]"));
}

function expectNoSecrets(lines: string[]) {
  for (const line of lines) {
    for (const secret of secrets) expect(line).not.toContain(secret);
  }
}

beforeEach(() => {
  process.env.USER_AUTH_URL = "https://auth.test/auth/";
  process.env.USER_URL = "https://user.test/user/";
  // vitest.setup.ts silences console.error; start each test from no calls.
  vi.mocked(console.error).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("identity upstream failure logging", () => {
  it("logs a 5xx with service, host, method, status and elapsed time", async () => {
    server.use(http.post("https://auth.test/auth/", () => maintenancePage()));

    await authenticate({ username: "alice", password: "s3cret-password" });

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^\[auth\] the BV-BRC authentication service \(auth\.test\) POST failed: HTTP 503 after \d+ ms$/,
    );
    expectNoSecrets(lines);
  });

  it("logs a spent budget as a timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(http.get("https://user.test/user/alice", neverRespond));

    const pending = getProfile("alice", "un=alice|tok-123");
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;

    const lines = loggedLines();
    expect(lines).toEqual([
      "[auth] the BV-BRC profile service (user.test) GET failed: timed out (budget 15000 ms) after 15000 ms",
    ]);
    expectNoSecrets(lines);
  });

  it("logs a network failure by its socket code", async () => {
    server.use(
      http.post("https://user.test/user/alice", () => {
        throw connectTimeout();
      }),
    );

    await updateProfile("alice", "un=alice|tok-123", []);

    const lines = loggedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^\[auth\] the BV-BRC profile service \(user\.test\) POST failed: UND_ERR_CONNECT_TIMEOUT after \d+ ms$/,
    );
    expectNoSecrets(lines);
  });

  it("does not log a 4xx, which is the caller's and not an outage", async () => {
    server.use(
      http.post("https://auth.test/auth/", () =>
        HttpResponse.text("bad credentials", { status: 401 }),
      ),
    );

    await authenticate({ username: "alice", password: "s3cret-password" });

    expect(loggedLines()).toEqual([]);
  });
});
