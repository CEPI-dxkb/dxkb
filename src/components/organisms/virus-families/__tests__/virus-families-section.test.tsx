import { fireEvent, render, screen, within } from "@testing-library/react";

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

  it("gives every family card an info button outside its link", () => {
    render(<VirusFamiliesSection />);

    // 20 cards; the mixed column renders twice for responsive CSS (jsdom has no CSS).
    const buttons = screen.getAllByRole("button", {
      name: /^Major human pathogens in /,
    });
    expect(buttons.length).toBeGreaterThanOrEqual(20);
    for (const button of buttons) {
      expect(button.closest("a")).toBeNull();
    }
  });

  it("lists a family's pathogens with taxon links from its info button", async () => {
    render(<VirusFamiliesSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "Major human pathogens in Coronaviridae" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Major human pathogens in Coronaviridae",
    });
    expect(
      within(dialog).getByRole("link", { name: "SARS-CoV-2" }),
    ).toHaveAttribute("href", "/taxonomy/2697049");
  });

  it("keeps the family card link and its existing label", () => {
    render(<VirusFamiliesSection />);

    expect(
      screen.getByRole("link", { name: "View Coronaviridae genomes" }),
    ).toHaveAttribute("href", "/taxonomy/11118");
  });
});
