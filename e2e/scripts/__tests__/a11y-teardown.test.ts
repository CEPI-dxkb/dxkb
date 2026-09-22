import { describe, expect, it } from "vitest";

import { summarizeScanRecords } from "../../a11y/teardown";
import type { ScanRecord } from "../../a11y/report";

function record(
  project: string,
  route: string,
  theme = "light",
  retry = 0,
): ScanRecord {
  return {
    project,
    route,
    theme,
    retry,
    blocking: [],
    suppressed: [],
    warnings: [],
  };
}

describe("accessibility scan summaries", () => {
  it("keeps browser projects separate and sorts project, route, then theme", () => {
    expect(
      summarizeScanRecords([
        record("webkit", "z"),
        record("firefox", "z"),
        record("firefox", "a", "dark"),
        record("firefox", "a"),
      ]).map(({ project, route, theme }) => [project, route, theme]),
    ).toEqual([
      ["firefox", "a", "dark"],
      ["firefox", "a", "light"],
      ["firefox", "z", "light"],
      ["webkit", "z", "light"],
    ]);
  });

  it("keeps the latest retry and rejects conflicts within one attempt", () => {
    const firstAttempt = record("webkit", "route");
    const retry = {
      ...firstAttempt,
      retry: 1,
      warnings: [{ id: "different" }] as ScanRecord["warnings"],
    };

    expect(summarizeScanRecords([retry, firstAttempt, retry])).toEqual([retry]);
    expect(() =>
      summarizeScanRecords([
        firstAttempt,
        {
          ...firstAttempt,
          warnings: [{ id: "different" }] as ScanRecord["warnings"],
        },
      ]),
    ).toThrow("webkit::route::light");
  });
});
