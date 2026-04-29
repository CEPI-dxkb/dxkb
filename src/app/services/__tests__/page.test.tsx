import { render, screen } from "@testing-library/react";
import ServicesIndexPage from "../page";

describe("ServicesIndexPage", () => {
  it("renders the heading", () => {
    render(<ServicesIndexPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /services/i }),
    ).toBeInTheDocument();
  });

  it("renders a category link for every bioinformatics category", () => {
    render(<ServicesIndexPage />);
    for (const label of [
      "Genomics",
      "Metagenomics",
      "Phylogenomics",
      "Protein Tools",
      "Utilities",
      "Viral Tools",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});
