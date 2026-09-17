import { render, screen } from "@testing-library/react";
import type { ExperimentViewRecord } from "@/lib/experiment-view";
import {
  emptyOverviewSectionTitles,
  overviewFieldValue,
  overviewSection,
  overviewSectionHrefs,
  overviewSectionLabels,
  overviewSectionTitles,
} from "@/test-helpers/overview";
import { ExperimentOverview } from "../experiment-overview";

function experimentRecord(
  overrides: Partial<ExperimentViewRecord> = {},
): ExperimentViewRecord {
  return { exp_id: "42", ...overrides };
}

describe("ExperimentOverview", () => {
  it("renders its six sections in the declared order", () => {
    render(<ExperimentOverview experiment={experimentRecord()} />);
    expect(overviewSectionTitles()).toEqual([
      "Study",
      "Experiment",
      "Repository and publication",
      "Organism and treatment",
      "Samples and biosets",
      "Additional metadata",
    ]);
  });

  it("keeps the hand-written field order inside a section", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({
          exp_name: "Exp A",
          exp_title: "Title A",
          exp_description: "Description A",
          exp_poc: "Contact A",
          experimenters: ["Alice", "Bob"],
          exp_type: "Transcriptomics",
          measurement_technique: "RNA-seq",
        })}
      />,
    );
    expect(overviewSectionLabels("Experiment")).toEqual([
      "Experiment ID",
      "Name",
      "Title",
      "Description",
      "Point of contact",
      "Experimenters",
      "Type",
      "Measurement technique",
    ]);
  });

  it("builds the exact PubMed destination and opens it safely in a new tab", () => {
    render(
      <ExperimentOverview experiment={experimentRecord({ pmid: 12345678 })} />,
    );
    const link = screen.getByRole("link", { name: "12345678" });
    expect(link).toHaveAttribute(
      "href",
      "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("builds the exact GEO destination for a GEO public identifier", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({
          public_repository: "GEO",
          public_identifier: "GSE123",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "GSE123" })).toHaveAttribute(
      "href",
      "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE123",
    );
  });

  it("builds the exact ArrayExpress destination, matching the repository case-insensitively", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({
          public_repository: " arrayexpress ",
          public_identifier: "E-MTAB-1",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "E-MTAB-1" })).toHaveAttribute(
      "href",
      "https://www.ebi.ac.uk/biostudies/arrayexpress/studies/E-MTAB-1",
    );
  });

  it("shows the public identifier as plain text when the repository has no known destination", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({
          public_repository: "SomethingElse",
          public_identifier: "X-1",
        })}
      />,
    );
    expect(
      overviewFieldValue("Repository and publication", "Public identifier"),
    ).toBe("X-1");
    expect(overviewSectionHrefs("Repository and publication")).toEqual([]);
  });

  it("links every genome ID to its exact internal destination, without new-tab attributes", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({ genome_id: ["83332.12", "100.1"] })}
      />,
    );
    expect(overviewSectionHrefs("Organism and treatment")).toEqual([
      "/genome/83332.12",
      "/genome/100.1",
    ]);
    for (const link of overviewSection(
      "Organism and treatment",
    ).querySelectorAll("a")) {
      expect(link).not.toHaveAttribute("target");
    }
  });

  it("accepts a single genome ID as well as a list", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({ genome_id: "83332.12" })}
      />,
    );
    expect(overviewSectionHrefs("Organism and treatment")).toEqual([
      "/genome/83332.12",
    ]);
  });

  it("links the bioset count to the experiment's own biosets tab", () => {
    render(
      <ExperimentOverview experiment={experimentRecord({ biosets: 3 })} />,
    );
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/experiment/42?tab=biosets",
    );
  });

  it("shows the new-tab icon only for destinations the classifier called external", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({ pmid: 12345678, biosets: 3 })}
      />,
    );
    // lucide renders an svg; the external PubMed link carries one, the
    // same-origin biosets link does not.
    const pubmed = screen.getByRole("link", { name: "12345678" });
    const biosets = screen.getByRole("link", { name: "3" });
    expect(pubmed.querySelector("svg")).not.toBeNull();
    expect(biosets.querySelector("svg")).toBeNull();
  });

  it("renders additional metadata as inspectable JSON, not [object Object]", () => {
    render(
      <ExperimentOverview
        experiment={experimentRecord({
          date_inserted: "2016-09-01T00:00:00Z",
          additional_metadata: { platform: "Illumina" },
        })}
      />,
    );
    expect(overviewSectionLabels("Additional metadata")).toEqual([
      "Date added",
      "Additional metadata",
    ]);
    expect(overviewFieldValue("Additional metadata", "Date added")).toBe(
      "2016-09-01T00:00:00Z",
    );
    expect(
      overviewFieldValue("Additional metadata", "Additional metadata"),
    ).toBe('{"platform":"Illumina"}');
  });

  it("applies the empty-section policy to every section but the one holding the experiment ID", () => {
    render(<ExperimentOverview experiment={experimentRecord()} />);
    expect(emptyOverviewSectionTitles()).toEqual([
      "Study",
      "Repository and publication",
      "Organism and treatment",
      "Samples and biosets",
      "Additional metadata",
    ]);
    expect(overviewSectionLabels("Experiment")).toEqual(["Experiment ID"]);
  });
});
