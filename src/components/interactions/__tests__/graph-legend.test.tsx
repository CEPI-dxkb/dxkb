import { render, screen } from "@testing-library/react";

import { GraphLegend } from "../graph-legend";
import { colors, edgeAlpha } from "@/lib/interactions/graph-theme";

describe("GraphLegend", () => {
  it("renders all five legend entries", () => {
    render(<GraphLegend />);

    for (const label of [
      "Microbial protein",
      "Host protein",
      "Selected",
      "Predicted interaction",
      "Experimentally verified",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("previews the same translucent interaction colors used by Sigma", () => {
    render(<GraphLegend />);
    const opacity = String(edgeAlpha / 255);
    expect(screen.getByTestId("predicted-interaction-swatch")).toHaveAttribute(
      "stroke",
      colors.edge,
    );
    expect(screen.getByTestId("predicted-interaction-swatch")).toHaveAttribute(
      "stroke-opacity",
      opacity,
    );
    expect(
      screen.getByTestId("experimental-interaction-swatch"),
    ).toHaveAttribute("stroke", colors.edgeExperimental);
    expect(
      screen.getByTestId("experimental-interaction-swatch"),
    ).toHaveAttribute("stroke-opacity", opacity);
  });

  it("exposes the svg as a single labelled image to assistive tech", () => {
    render(<GraphLegend />);
    expect(
      screen.getByRole("img", { name: "Graph legend" }),
    ).toBeInTheDocument();
  });

  it("drives text off the theme foreground so labels stay legible in dark mode", () => {
    render(<GraphLegend />);
    // Without [&_text]:fill-foreground the SVG text defaults to black and vanishes on the dark
    // canvas.
    expect(screen.getByRole("img", { name: "Graph legend" })).toHaveClass(
      "[&_text]:fill-foreground",
    );
  });
});
