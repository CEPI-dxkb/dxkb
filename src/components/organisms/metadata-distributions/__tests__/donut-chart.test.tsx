import { act, fireEvent, render, screen, within } from "@testing-library/react";

// Make framer-motion's animate call onUpdate(1) and onComplete immediately so
// animation-driven arc paths are fully rendered in synchronous tests.
vi.mock("framer-motion", () => ({
  animate: vi.fn(
    (
      _from: number,
      to: number,
      opts: { onUpdate?: (v: number) => void; onComplete?: () => void } = {},
    ) => {
      opts.onUpdate?.(to);
      opts.onComplete?.();
      return { stop: vi.fn() };
    },
  ),
}));

import { DonutChart } from "../donut-chart";

// Constants mirrored from the component for hit-test coordinate calculations
const chartSize = 160;
const chartCenter = chartSize / 2;
const outerRadius = 66;

// Make requestAnimationFrame synchronous so animation useEffect completes
// immediately on render.
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(
    (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    },
  );
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DonutChart", () => {
  it("renders top nine slices and an Others bucket", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "A", value: 10 },
          { label: "B", value: 9 },
          { label: "C", value: 8 },
          { label: "D", value: 7 },
          { label: "E", value: 6 },
          { label: "F", value: 5 },
          { label: "G", value: 4 },
          { label: "H", value: 3 },
          { label: "I", value: 2 },
          { label: "J", value: 2 },
          { label: "K", value: 1 },
        ]}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Genus distribution" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Others")).toBeInTheDocument();
    // A–I are shown individually; J(2)+K(1)=3 collapse into Others
    expect(
      within(screen.getByRole("img")).getByLabelText("Others: 3"),
    ).toBeInTheDocument();
  });

  it("uses a collision-free label for the aggregate bucket", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "Others", value: 10 },
          { label: "A", value: 9 },
          { label: "B", value: 8 },
          { label: "C", value: 7 },
          { label: "D", value: 6 },
          { label: "E", value: 5 },
          { label: "F", value: 4 },
          { label: "G", value: 3 },
          { label: "H", value: 2 },
          { label: "I", value: 2 },
          { label: "J", value: 1 },
        ]}
      />,
    );

    // "Others" is one of the top 9 shown items; the aggregate bucket for the
    // remaining items must pick the fallback label "Other values" to avoid collision.
    expect(screen.getByText("Others")).toBeInTheDocument();
    expect(screen.getByText("Other values")).toBeInTheDocument();
  });

  it("shows tooltip content on hover over the ring", () => {
    render(
      <DonutChart title="Host" data={[{ label: "Homo sapiens", value: 12 }]} />,
    );

    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    vi.spyOn(svg as SVGSVGElement, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: chartSize,
      height: chartSize,
      right: chartSize,
      bottom: chartSize,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // clientX=80,clientY=25 → svgX=0, svgY=-55 → dist=55 (inside ring: 38<55<66)
    fireEvent.mouseMove(screen.getByTestId("chart-overlay"), {
      clientX: chartCenter,
      clientY: chartCenter - outerRadius + 17,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Homo sapiens");
    expect(screen.getByRole("status")).toHaveTextContent("12");
  });

  it("hides tooltip when hovering the inner hole", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(
      <DonutChart title="Host" data={[{ label: "Homo sapiens", value: 12 }]} />,
    );

    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    if (!svg) throw new Error("svg not found");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: chartSize,
      height: chartSize,
      right: chartSize,
      bottom: chartSize,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const overlay = screen.getByTestId("chart-overlay");

    // First hover the ring to show tooltip
    fireEvent.mouseMove(overlay, {
      clientX: chartCenter,
      clientY: chartCenter - outerRadius + 17,
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Then move into the inner hole — clientX=80, clientY=80 → dist=0 < innerRadius
    fireEvent.mouseMove(overlay, {
      clientX: chartCenter,
      clientY: chartCenter,
    });
    // deactivate() schedules a 40ms timer — advance past it
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renders blank labels as Unspecified", () => {
    render(<DonutChart title="Host" data={[{ label: "", value: 76420 }]} />);

    expect(screen.getByText("Unspecified")).toBeInTheDocument();
    expect(
      within(screen.getByRole("img")).getByLabelText("Unspecified: 76,420"),
    ).toBeInTheDocument();
  });

  it("renders title attributes on arc paths for screen readers", () => {
    render(
      <DonutChart
        title="Genus"
        data={[{ label: "Salmonella", value: 48185 }]}
      />,
    );

    expect(document.querySelector("path > title")).toHaveTextContent(
      "Salmonella: 48,185",
    );
  });

  it("renders an empty chart and gray legend", () => {
    render(<DonutChart title="Country" data={[]} />);

    expect(
      screen.getByRole("img", { name: "Country distribution" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No data available" }),
    ).toHaveTextContent("No data available");
    expect(
      within(screen.getByRole("img")).getByRole("graphics-symbol", {
        name: "No data available",
      }),
    ).toHaveAttribute("fill", "var(--muted-foreground)");

    const placeholder = screen.getByRole("button", {
      name: "No data available",
    });
    fireEvent.mouseEnter(placeholder);
    fireEvent.focus(placeholder);
    fireEvent.click(placeholder);
    expect(placeholder).not.toHaveAttribute("data-active");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders a non-degenerate annulus path for a single positive slice", () => {
    render(
      <DonutChart
        title="Genus"
        data={[{ label: "Salmonella", value: 48185 }]}
      />,
    );

    const path = document.querySelector("path");
    expect(path).not.toBeNull();
    const d = path?.getAttribute("d") ?? "";
    // Old behavior was a "M outerR 0 A ... M outerR 0 A ..." degenerate arc
    // (start == end). The full-circle fix emits two semicircle arcs for both
    // the outer and inner circle — at least 4 arc commands plus the outer
    // -outerR landing point.
    const arcCount = (d.match(/ A /g) ?? []).length;
    expect(arcCount).toBeGreaterThanOrEqual(4);
    expect(d).toMatch(/-66\s+0/); // outer semicircle landing at (-outerR, 0)
  });

  it("legend pill mouse enter activates the slice highlight", () => {
    render(
      <DonutChart
        layout="side"
        title="Genus"
        data={[
          { label: "Escherichia", value: 100 },
          { label: "Salmonella", value: 50 },
        ]}
      />,
    );

    const pill = screen.getByRole("button", { name: /Escherichia/ });
    expect(pill).not.toHaveAttribute("data-active");
    fireEvent.mouseEnter(pill);
    expect(pill).toHaveAttribute("data-active", "true");
  });

  it("legend blur clears the active slice highlight after the deactivate delay", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    render(
      <DonutChart
        layout="side"
        title="Genus"
        data={[
          { label: "Escherichia", value: 100 },
          { label: "Salmonella", value: 50 },
        ]}
      />,
    );

    const pill = screen.getByRole("button", { name: /Escherichia/ });
    fireEvent.mouseEnter(pill);
    expect(pill).toHaveAttribute("data-active", "true");

    fireEvent.blur(pill);
    // deactivate() uses a 40ms timer — highlight should still be present before it fires
    expect(pill).toHaveAttribute("data-active", "true");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(pill).not.toHaveAttribute("data-active");

    vi.useRealTimers();
  });

  it("renders tab buttons when tabs prop is provided", () => {
    render(
      <DonutChart
        title="Taxonomic Distribution"
        tabs={[
          { label: "Genus", data: [{ label: "Brucella", value: 100 }] },
          { label: "Species", data: [{ label: "B. abortus", value: 50 }] },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Genus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Species" })).toBeInTheDocument();
    // First tab active by default — first tab's data is shown
    expect(
      within(screen.getByRole("img")).getByLabelText("Brucella: 100"),
    ).toBeInTheDocument();
  });

  it("clicking an inactive tab switches the chart data", () => {
    render(
      <DonutChart
        title="Taxonomic Distribution"
        tabs={[
          { label: "Genus", data: [{ label: "Brucella", value: 100 }] },
          { label: "Species", data: [{ label: "B. abortus", value: 50 }] },
        ]}
      />,
    );

    // Initial: Genus data visible
    expect(
      within(screen.getByRole("img")).getByLabelText("Brucella: 100"),
    ).toBeInTheDocument();

    // Click Species tab
    fireEvent.click(screen.getByRole("button", { name: "Species" }));

    // Now: Species data visible
    expect(
      within(screen.getByRole("img")).getByLabelText("B. abortus: 50"),
    ).toBeInTheDocument();
  });

  it("resets hidden legend items when changing tabs", () => {
    render(
      <DonutChart
        title="Taxonomic Distribution"
        tabs={[
          {
            label: "Genus",
            data: [
              { label: "Alpha", value: 10 },
              { label: "Beta", value: 5 },
            ],
          },
          { label: "Species", data: [{ label: "Gamma", value: 7 }] },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Alpha: 10" }));
    expect(screen.getByRole("button", { name: "Alpha: 10" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Species" }));
    fireEvent.click(screen.getByRole("button", { name: "Genus" }));

    expect(screen.getByRole("button", { name: "Alpha: 10" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("clamps legend tooltips to the chart and keeps the caret on the arc", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "Alpha", value: 75 },
          { label: "Beta", value: 25 },
        ]}
      />,
    );

    const svg = screen.getByRole("img", { name: "Genus distribution" });
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 20,
      width: chartSize,
      height: chartSize,
      right: 100 + chartSize,
      bottom: 20 + chartSize,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    });

    fireEvent.focus(screen.getByRole("button", { name: "Alpha: 75" }));

    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveStyle({
      left: "180px",
      transform: "translateX(-50%)",
    });
    expect(
      tooltip.querySelector('[aria-hidden="true"]')?.getAttribute("style"),
    ).toMatch(/left: calc\(50% \+ 52\.32\d+px\)/);
  });

  it("renders the title as an h3 heading (WCAG 1.3.1)", () => {
    render(<DonutChart title="Genus" data={[{ label: "Alpha", value: 10 }]} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Genus" }),
    ).toBeInTheDocument();
  });

  it("exposes aria-pressed on legend pills and toggles on click (WCAG 4.1.2)", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "Alpha", value: 10 },
          { label: "Beta", value: 5 },
        ]}
        layout="side"
      />,
    );

    const alphaPill = screen.getByRole("button", { name: /Alpha/ });
    expect(alphaPill).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(alphaPill);
    expect(alphaPill).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(alphaPill);
    expect(alphaPill).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the tooltip when a legend pill is focused (WCAG 1.4.13)", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "Alpha", value: 75 },
          { label: "Beta", value: 25 },
        ]}
        layout="side"
      />,
    );

    // No tooltip before focus
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("button", { name: /Alpha/ }));

    // Tooltip should now be present with the slice's label, value, and percentage
    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveTextContent("Alpha");
    expect(tooltip).toHaveTextContent("75");
    expect(tooltip).toHaveTextContent("75%");
  });

  it("shows the tooltip on legend mouse hover, not just on chart hover", () => {
    render(
      <DonutChart
        title="Genus"
        data={[
          { label: "Alpha", value: 60 },
          { label: "Beta", value: 40 },
        ]}
        layout="side"
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Beta/ }));

    const tooltip = screen.getByRole("status");
    expect(tooltip).toHaveTextContent("Beta");
    expect(tooltip).toHaveTextContent("40");
    expect(tooltip).toHaveTextContent("40%");
  });
});
