import type { QueryState } from "@tanstack/react-query";

import {
  errorBackoffPollInterval,
  firstErrorPollIntervalMs,
  maxErrorPollIntervalMs,
} from "@/lib/api/poll-backoff";

function makeQuery(status: QueryState["status"], errorUpdateCount = 0) {
  return { state: { status, errorUpdateCount } };
}

describe("errorBackoffPollInterval", () => {
  it("defers to the normal interval while the query is pending or succeeding", () => {
    expect(errorBackoffPollInterval(makeQuery("pending"))).toBeUndefined();
    expect(errorBackoffPollInterval(makeQuery("success"))).toBeUndefined();
  });

  it("starts at 30 s and doubles with each failed poll in a row, capped at 5 min", () => {
    const query = makeQuery("error");
    const intervals = [1, 2, 3, 4, 5, 6, 50].map((failedPolls) => {
      query.state.errorUpdateCount = failedPolls;
      return errorBackoffPollInterval(query);
    });

    expect(intervals).toEqual([
      firstErrorPollIntervalMs,
      60_000,
      120_000,
      240_000,
      maxErrorPollIntervalMs,
      maxErrorPollIntervalMs,
      maxErrorPollIntervalMs,
    ]);
  });

  it("restarts the back-off after a successful poll", () => {
    const query = makeQuery("error", 4);
    expect(errorBackoffPollInterval(query)).toBe(240_000);

    query.state = { status: "success", errorUpdateCount: 4 };
    expect(errorBackoffPollInterval(query)).toBeUndefined();

    query.state = { status: "error", errorUpdateCount: 5 };
    expect(errorBackoffPollInterval(query)).toBe(firstErrorPollIntervalMs);
  });

  it("tracks each query separately", () => {
    const recovered = makeQuery("success", 3);
    errorBackoffPollInterval(recovered);
    recovered.state = { status: "error", errorUpdateCount: 4 };

    expect(errorBackoffPollInterval(recovered)).toBe(firstErrorPollIntervalMs);
    expect(errorBackoffPollInterval(makeQuery("error", 4))).toBe(240_000);
  });
});
