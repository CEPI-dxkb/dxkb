import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { OverviewSection } from "../overview-section";

/** Rendered `<dt>` labels, in DOM order. */
function renderedLabels(): string[] {
  return screen.queryAllByRole("term").map((dt) => dt.textContent);
}

describe("OverviewSection", () => {
  it("renders available fields in the order the field list gives them", () => {
    render(
      <OverviewSection
        title="Assembly summary"
        fields={[
          { label: "Genome length", value: 4411532 },
          { label: "Contigs", value: 1 },
          { label: "GC content", value: 65.6 },
        ]}
      />,
    );
    expect(renderedLabels()).toEqual([
      "Genome length",
      "Contigs",
      "GC content",
    ]);
  });

  it("filters unavailable fields out without disturbing the order of the rest", () => {
    render(
      <OverviewSection
        title="Assembly summary"
        fields={[
          { label: "Genome length", value: 4411532 },
          { label: "Chromosomes", value: null },
          { label: "Plasmids", value: [] },
          { label: "GC content", value: 65.6 },
          { label: "Assembly accession", value: "" },
        ]}
      />,
    );
    expect(renderedLabels()).toEqual(["Genome length", "GC content"]);
  });

  it("keeps 0 and false, which are values rather than absences", () => {
    render(
      <OverviewSection
        title="Assembly summary"
        fields={[
          { label: "Contigs", value: 0 },
          { label: "Complete", value: false },
        ]}
      />,
    );
    expect(renderedLabels()).toEqual(["Contigs", "Complete"]);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("applies the single empty-section policy: the title stays, with the shared fallback", () => {
    render(
      <OverviewSection
        title="Quality and status"
        fields={[
          { label: "Genome status", value: null },
          { label: "Genome quality", value: undefined },
        ]}
      />,
    );
    expect(screen.getByText("Quality and status")).toBeInTheDocument();
    expect(screen.getByText("No data available.")).toBeInTheDocument();
  });

  it("never renders an empty definition list — the <dl> is absent, not childless", () => {
    const { container } = render(
      <OverviewSection
        title="Quality and status"
        fields={[{ label: "Genome status", value: null }]}
      />,
    );
    expect(container.querySelector("dl")).toBeNull();
  });

  it("applies the empty-section policy for an empty field list too", () => {
    const { container } = render(
      <OverviewSection title="Nothing here" fields={[]} />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("No data available.")).toBeInTheDocument();
    expect(container.querySelector("dl")).toBeNull();
  });

  it("honors an available override so a field with custom content can survive an unavailable value", () => {
    render(
      <OverviewSection
        title="Organism and protein"
        fields={[
          {
            label: "Taxon ID",
            value: null,
            available: true,
            children: <span>11320</span>,
          },
        ]}
      />,
    );
    expect(renderedLabels()).toEqual(["Taxon ID"]);
    expect(screen.getByText("11320")).toBeInTheDocument();
  });

  it("honors an available override of false even when the value would render", () => {
    render(
      <OverviewSection
        title="Organism and protein"
        fields={[
          { label: "Taxon ID", value: "not-a-taxon", available: false },
          { label: "Organism", value: "Influenza A" },
        ]}
      />,
    );
    expect(renderedLabels()).toEqual(["Organism"]);
  });

  it("renders custom children in place of the formatted value", () => {
    render(
      <OverviewSection
        title="Annotation summary"
        fields={[
          {
            label: "CDS",
            value: 4004,
            children: <Link href="/feature?rql=x">4004</Link>,
          },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "4004" });
    expect(link).toHaveAttribute("href", "/feature?rql=x");
  });

  it("applies a per-field className to the dd", () => {
    render(
      <OverviewSection
        title="Repository and publication"
        fields={[{ label: "PubMed", value: "1", className: "custom-class" }]}
      />,
    );
    const dd = screen.getByRole("definition");
    expect(dd).toHaveClass("custom-class");
  });
});
