import { render, screen } from "@testing-library/react";

import { VirusFamiliesSection } from "../virus-families-section";

describe("VirusFamiliesSection", () => {
  it("renders the section heading", () => {
    render(<VirusFamiliesSection />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Virus Families" }),
    ).toBeInTheDocument();
  });

  it("renders the subtitle description", () => {
    render(<VirusFamiliesSection />);

    expect(
      screen.getByText("Common viral family groupings organized by genome type."),
    ).toBeInTheDocument();
  });

  it("renders at least one virus family from the static data", () => {
    render(<VirusFamiliesSection />);

    expect(screen.getByText("Coronaviridae")).toBeInTheDocument();
  });

  it("renders a subgroup label from the mixed column", () => {
    render(<VirusFamiliesSection />);

    // The mixed column is rendered twice for responsive CSS, so expect at least one match.
    expect(screen.getAllByText(/DS-RNA|SS-DNA|Partially/).length).toBeGreaterThan(0);
  });
});
