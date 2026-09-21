import { describe, expect, it } from "vitest";

import { summarizeScanRecords } from "../../a11y/teardown";
import type { ScanRecord } from "../../a11y/report";

function record(project: string, route: string, theme = "light"): ScanRecord {
  return { project, route, theme, blocking: [], suppressed: [], warnings: [] };
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

  it("deduplicates retries but rejects conflicts within one project", () => {
    const scan = record("webkit", "route");
    expect(summarizeScanRecords([scan, scan])).toEqual([scan]);
    expect(() =>
      summarizeScanRecords([
        scan,
        { ...scan, theme: "light", blocking: [] },
        { ...scan, warnings: [{ id: "different" }] as ScanRecord["warnings"] },
      ]),
    ).toThrow("webkit::route::light");
  });
});
