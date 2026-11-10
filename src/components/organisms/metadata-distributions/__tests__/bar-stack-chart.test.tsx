import { fireEvent, render, screen } from "@testing-library/react";

import { BarStackChart } from "../bar-stack-chart";
import type { SerotypeDistributionData } from "@/lib/services/organisms/types";

const twoYearData: SerotypeDistributionData = {
  serovars: ["Sv1", "Sv2", "Sv3"],
  years: [
    { year: 2023, Sv1: 10, Sv2: 5, Sv3: 2 },
    { year: 2024, Sv1: 20, Sv2: 8, Sv3: 4 },
  ],
};

describe("BarStackChart", () => {
  it("renders empty state when no years", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={{ years: [], serovars: [] }}
      />,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders an SVG with the correct aria-label", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Serotype Distribution (Last 10 Years) distribution",
      }),
    ).toBeInTheDocument();
  });

  it("renders one legend pill per serovar", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    expect(screen.getByText("Sv1")).toBeInTheDocument();
    expect(screen.getByText("Sv2")).toBeInTheDocument();
    expect(screen.getByText("Sv3")).toBeInTheDocument();
  });

  it("hovering a legend pill activates that serovar", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    const sv2Pill = screen.getByRole("button", { name: "Sv2" });
    fireEvent.mouseEnter(sv2Pill);

    expect(sv2Pill).toHaveAttribute("data-active", "true");
  });

  it("leaving a legend pill clears the active state", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    const sv2Pill = screen.getByRole("button", { name: "Sv2" });
    fireEvent.mouseEnter(sv2Pill);
    fireEvent.mouseLeave(sv2Pill);

    expect(sv2Pill).not.toHaveAttribute("data-active", "true");
  });

  it("clicking a legend pill locks the active state through mouseleave", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    const sv1Pill = screen.getByRole("button", { name: "Sv1" });
    fireEvent.click(sv1Pill);
    fireEvent.mouseLeave(sv1Pill);

    expect(sv1Pill).toHaveAttribute("data-active", "true");
  });

  it("clicking a locked pill a second time releases the lock", () => {
    render(
      <BarStackChart
        title="Serotype Distribution (Last 10 Years)"
        data={twoYearData}
      />,
    );

    const sv1Pill = screen.getByRole("button", { name: "Sv1" });
    fireEvent.click(sv1Pill);
    fireEvent.click(sv1Pill);
    fireEvent.mouseLeave(sv1Pill);

    expect(sv1Pill).not.toHaveAttribute("data-active", "true");
  });

  it("renders the title as an h3 heading in the happy path (WCAG 1.3.1)", () => {
    render(
      <BarStackChart
        title="Serotype History"
        data={twoYearData}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Serotype History" }),
    ).toBeInTheDocument();
  });
});
