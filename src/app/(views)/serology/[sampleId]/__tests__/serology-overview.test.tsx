import { render, screen } from "@testing-library/react";
import type { SerologyViewRecord } from "@/lib/serology-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { SerologyOverview } from "../serology-overview";

function serologyRecord(
  overrides: Partial<SerologyViewRecord> = {},
): SerologyViewRecord {
  return { id: "1", sample_identifier: "S-1", ...overrides };
}

describe("SerologyOverview", () => {
  it("renders its five sections in the order the overview declares", () => {
    render(<SerologyOverview serology={serologyRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Sample Info",
      "Host",
      "Collection",
      "Tests",
      "Other",
    ]);
  });

  it("orders fields by the serology field map, not by the row's key order", () => {
    render(
      <SerologyOverview
        serology={serologyRecord({
          // Row keys are in neither the field map's order nor alphabetical
          // order, so the expectation below can only be met by the field map.
          sample_identifier: "S-1",
          contributing_institution: "Argonne",
          project_identifier: "P-9",
        })}
      />,
    );
    expect(overviewSectionLabels("Sample Info")).toEqual([
      "Project Identifier",
      "Contributing Institution",
      "Sample Identifier",
    ]);
  });

  it("truncates a source date to the precision the source actually carried", () => {
    render(
      <SerologyOverview
        serology={serologyRecord({
          collection_date: "2021-07-14T00:00:00Z",
          date_inserted: "2019",
          date_modified: "2020-05",
        })}
      />,
    );
    expect(overviewFieldValue("Collection", "Collection Date")).toBe(
      "2021-07-14",
    );
    expect(overviewFieldValue("Other", "Date Inserted")).toBe("2019");
    expect(overviewFieldValue("Other", "Date Modified")).toBe("2020-05");
  });

  it("joins a multi-valued field rather than showing [object Object] or a bare array", () => {
    render(
      <SerologyOverview
        serology={serologyRecord({ serotype: ["H1N1", "H3N2"] })}
      />,
    );
    expect(overviewFieldValue("Tests", "Serotype")).toBe("H1N1, H3N2");
  });

  it("applies the empty-section policy to every section with no populated field", () => {
    render(<SerologyOverview serology={serologyRecord()} />);
    // Only Sample Info has a value (the required sample_identifier).
    expect(emptyOverviewSectionTitles()).toEqual([
      "Host",
      "Collection",
      "Tests",
      "Other",
    ]);
    expect(overviewSectionLabels("Host")).toEqual([]);
  });

  it("renders no links at all — serology carries no link-bearing field", () => {
    render(
      <SerologyOverview
        serology={serologyRecord({
          comments: "see attached",
          test_type: "HAI",
        })}
      />,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
