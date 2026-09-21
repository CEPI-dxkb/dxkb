import { render, screen } from "@testing-library/react";
import type { SurveillanceViewRecord } from "@/lib/surveillance-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { SurveillanceOverview } from "../surveillance-overview";

function surveillanceRecord(
  overrides: Partial<SurveillanceViewRecord> = {},
): SurveillanceViewRecord {
  return { id: "1", sample_identifier: "S-1", ...overrides };
}

describe("SurveillanceOverview", () => {
  it("renders its ten sections in the order the overview declares", () => {
    render(<SurveillanceOverview surveillance={surveillanceRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Sample Info",
      "Collection",
      "Tests",
      "Host",
      "Environmental Exposure",
      "Clinical Data",
      "Symptoms/Diagnosis",
      "Treatment",
      "Vaccination",
      "Other",
    ]);
  });

  it("orders fields by the surveillance field map, not by the row's key order", () => {
    render(
      <SurveillanceOverview
        surveillance={surveillanceRecord({
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
      <SurveillanceOverview
        surveillance={surveillanceRecord({
          collection_date: "2021-07-14T00:00:00Z",
          submission_date: "2019",
          date_inserted: "2020-05",
        })}
      />,
    );
    expect(overviewFieldValue("Collection", "Collection Date")).toBe(
      "2021-07-14",
    );
    expect(overviewFieldValue("Sample Info", "Submission Date")).toBe("2019");
    expect(overviewFieldValue("Other", "Date Inserted")).toBe("2020-05");
  });

  it("shows latitude and longitude as one combined Coordinates field, last in Collection", () => {
    render(
      <SurveillanceOverview
        surveillance={surveillanceRecord({
          collection_city: "Chicago",
          collection_latitude: "41.8781",
          collection_longitude: "-87.6298",
        })}
      />,
    );
    const labels = overviewSectionLabels("Collection");
    expect(labels).toContain("Coordinates");
    expect(labels.at(-1)).toBe("Coordinates");
    expect(labels).not.toContain("Collection Latitude");
    expect(labels).not.toContain("Collection Longitude");
    expect(overviewFieldValue("Collection", "Coordinates")).toContain(
      "41.8781",
    );
  });

  it("omits Coordinates when only one half of the pair is present", () => {
    render(
      <SurveillanceOverview
        surveillance={surveillanceRecord({ collection_latitude: "41.8781" })}
      />,
    );
    expect(overviewSectionLabels("Collection")).not.toContain("Coordinates");
    expect(emptyOverviewSectionTitles()).toContain("Collection");
  });

  it("renders additional metadata as inspectable JSON, not [object Object]", () => {
    render(
      <SurveillanceOverview
        surveillance={surveillanceRecord({
          additional_metadata: { assay: "PCR" },
        })}
      />,
    );
    expect(overviewFieldValue("Other", "Additional Metadata")).toBe(
      '{"assay":"PCR"}',
    );
  });

  it("applies the empty-section policy to every section with no populated field", () => {
    render(<SurveillanceOverview surveillance={surveillanceRecord()} />);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Collection",
      "Tests",
      "Host",
      "Environmental Exposure",
      "Clinical Data",
      "Symptoms/Diagnosis",
      "Treatment",
      "Vaccination",
      "Other",
    ]);
  });

  it("renders no links at all — surveillance carries no link-bearing field", () => {
    render(
      <SurveillanceOverview
        surveillance={surveillanceRecord({
          comments: "see attached",
          diagnosis: "influenza",
        })}
      />,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
