import { renderHook } from "@testing-library/react";
import { useJobsColumns } from "@/components/jobs/jobs-table-columns";
import {
  defaultJobsUrlState,
  jobsUrlParamNames,
  parseJobsUrlState,
  serializeJobsUrlState,
} from "../jobs-url-state";

const parse = (query: string) => parseJobsUrlState(new URLSearchParams(query));

describe("jobs URL state", () => {
  it("is the default list when the URL has no params", () => {
    expect(parse("")).toStrictEqual(defaultJobsUrlState);
    expect(serializeJobsUrlState(defaultJobsUrlState).toString()).toBe("");
  });

  it("round-trips every field in a stable order", () => {
    const query =
      "status=failed&service=GenomeAssembly2&q=ecoli&archived=true&from=2026-09-01&to=2026-09-10&sort=start_time%3Aasc&page=3&pageSize=50";
    expect(serializeJobsUrlState(parse(query)).toString()).toBe(query);
  });

  it.each([
    ["an unknown status", "status=bogus", { status: "all" }],
    ["page 0", "page=0", { page: 1 }],
    ["a non-numeric page", "page=two", { page: 1 }],
    ["an unsupported page size", "pageSize=7", { pageSize: 200 }],
    [
      "an unsortable field",
      "sort=parameters:asc",
      { sort: defaultJobsUrlState.sort },
    ],
    ["a bad direction", "sort=app:sideways", { sort: defaultJobsUrlState.sort }],
    ["an impossible date", "from=2026-02-30", { dateFrom: undefined }],
  ])("ignores %s", (_label, query, expected) => {
    expect(parse(query)).toMatchObject(expected);
  });

  it("owns exactly the param names it writes", () => {
    // The jobs URL hook drops these names and keeps every other param, so a
    // field added to the serializer without a name here would be written twice.
    const query =
      "status=failed&service=GenomeAssembly2&q=ecoli&archived=true&from=2026-09-01&to=2026-09-10&sort=start_time%3Aasc&page=3&pageSize=50";
    const written = [...serializeJobsUrlState(parse(query)).keys()];
    expect([...jobsUrlParamNames].sort()).toStrictEqual(written.sort());
  });

  it("accepts the sort field of every sortable jobs column", () => {
    // A column added with a sortField the parser refuses would write
    // sort=<field>:asc, then snap back to the default, so its header looks dead.
    const { result } = renderHook(() =>
      useJobsColumns(defaultJobsUrlState.sort, vi.fn()),
    );
    const sortFields = result.current.columns.flatMap((column) =>
      column.meta?.sortField ? [column.meta.sortField] : [],
    );
    expect(sortFields.length).toBeGreaterThan(0);
    for (const field of sortFields) {
      expect(parse(`sort=${field}:asc`).sort).toStrictEqual({
        field,
        direction: "asc",
      });
    }
  });
});
