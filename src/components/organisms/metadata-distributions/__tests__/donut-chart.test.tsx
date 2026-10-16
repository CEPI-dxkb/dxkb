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

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { animate } from "framer-motion";

import { DonutChart } from "../donut-chart";

// Constants mirrored from the component for hit-test coordinate calculations
const chartSize = 160;
const chartCenter = chartSize / 2;
const outerRadius = 66;
const popDistance = 8;

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
    expect(tooltip).toHaveStyle({ left: "180px" });
    expect(tooltip).toHaveClass("-translate-x-1/2");
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

  describe("linked slices", () => {
    const linked = [
      { label: "Human", value: 30, href: "/genomes?host=Human" },
      { label: "Bat", value: 10, href: "/genomes?host=Bat" },
    ];

    function mockSvgRect() {
      const svg = document.querySelector("svg");
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
    }

    // 12 o'clock, inside the ring: Human's slice, which starts at 9 o'clock
    // and sweeps three quarters of the ring.
    const onHuman = { clientX: chartCenter, clientY: chartCenter - outerRadius + 17 };

    // A point `degrees` clockwise from 12 o'clock, `radius` from the center
    // (the default is inside the ring).
    const ringPoint = (degrees: number, radius = 52) => {
      const radians = (degrees * Math.PI) / 180;
      return {
        clientX: chartCenter + radius * Math.sin(radians),
        clientY: chartCenter - radius * Math.cos(radians),
      };
    };

    // Past the ring's outer edge, on the line through the middle of Human's
    // slice (45°), where its rim lands once it pops out.
    const onHumanRim = ringPoint(45, outerRadius + popDistance / 2);

    beforeEach(() => {
      push.mockClear();
    });

    it("follows the slice under the pointer and shows the pointer cursor", () => {
      render(<DonutChart title="Host" data={linked} />);
      mockSvgRect();
      const overlay = screen.getByTestId("chart-overlay");

      expect(overlay).not.toHaveClass("cursor-pointer");
      fireEvent.mouseMove(overlay, onHuman);
      expect(overlay).toHaveClass("cursor-pointer");

      fireEvent.click(overlay, onHuman);
      expect(push).toHaveBeenCalledWith("/genomes?host=Human");
    });

    it("opens a modified click in a new tab", () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      render(<DonutChart title="Host" data={linked} />);
      mockSvgRect();

      fireEvent.click(screen.getByTestId("chart-overlay"), {
        ...onHuman,
        metaKey: true,
      });

      expect(open).toHaveBeenCalledWith("/genomes?host=Human", "_blank", "noopener");
      expect(push).not.toHaveBeenCalled();
    });

    it("follows nothing from the donut's hole", () => {
      render(<DonutChart title="Host" data={linked} />);
      mockSvgRect();

      fireEvent.click(screen.getByTestId("chart-overlay"), {
        clientX: chartCenter,
        clientY: chartCenter,
      });

      expect(push).not.toHaveBeenCalled();
    });

    it("keeps a popped-out slice live and linked across its exposed rim", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      render(<DonutChart title="Host" data={linked} />);
      mockSvgRect();
      const overlay = screen.getByTestId("chart-overlay");
      // The overlay reaches the rim, so the pointer never leaves it for the
      // popped path, which has no handlers of its own.
      expect(overlay).toHaveAttribute("r", String(outerRadius + popDistance));

      fireEvent.mouseMove(overlay, onHuman);
      fireEvent.mouseMove(overlay, onHumanRim);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Human: 30");
      expect(overlay).toHaveClass("cursor-pointer");

      fireEvent.click(overlay, onHumanRim);
      expect(push).toHaveBeenCalledExactlyOnceWith("/genomes?host=Human");

      vi.useRealTimers();
    });

    it("keeps the rest of the outer edge dead", () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      render(<DonutChart title="Host" data={linked} />);
      mockSvgRect();
      const overlay = screen.getByTestId("chart-overlay");

      // Nothing is popped out yet, so Human's rim is not drawn there.
      fireEvent.click(overlay, onHumanRim);
      expect(push).not.toHaveBeenCalled();

      // With Human popped out, Bat (180°→270°) has nothing past the edge, and
      // neither do Human's own far corners.
      fireEvent.mouseMove(overlay, onHuman);
      const offBat = ringPoint(225, outerRadius + popDistance / 2);
      const offHumanCorner = ringPoint(170, outerRadius + popDistance / 2);
      fireEvent.click(overlay, offBat);
      fireEvent.click(overlay, offHumanCorner);
      expect(push).not.toHaveBeenCalled();

      fireEvent.mouseMove(overlay, offBat);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it("hit-tests the slices where they are drawn mid-animation, skipping a hidden one", () => {
      render(
        <DonutChart
          title="Host"
          data={[
            { label: "Human", value: 10, href: "/genomes?host=Human" },
            { label: "Bat", value: 10, href: "/genomes?host=Bat" },
            { label: "Mouse", value: 20, href: "/genomes?host=Mouse" },
          ]}
        />,
      );
      mockSvgRect();
      const overlay = screen.getByTestId("chart-overlay");

      // Hold the animation the legend toggle starts, to step its frames by hand.
      const held: { update?: (t: number) => void; complete?: () => void } = {};
      vi.mocked(animate).mockImplementationOnce(((
        _from: number,
        _to: number,
        opts: { onUpdate?: (t: number) => void; onComplete?: () => void },
      ) => {
        held.update = opts.onUpdate;
        held.complete = opts.onComplete;
        return { stop: vi.fn() };
      }) as unknown as typeof animate);

      // Human, Bat and Mouse sit at -90°→0°, 0°→90° and 90°→270°. Hiding Human
      // retargets Bat to -90°→30° and Mouse to 30°→270°; halfway there, Bat is
      // drawn at -45°→60°, Mouse at 60°→270°, and Human shrinks at -67.5°→-22.5°.
      fireEvent.click(screen.getByRole("button", { name: "Human: 10" }));
      act(() => {
        held.update?.(0.5);
      });

      // 45° is drawn as Bat, though it ends up Mouse's.
      fireEvent.mouseMove(overlay, ringPoint(45));
      expect(screen.getByRole("status")).toHaveTextContent("Bat: 10");
      fireEvent.click(overlay, ringPoint(45));
      expect(push).toHaveBeenCalledExactlyOnceWith("/genomes?host=Bat");

      // 75° was Bat's in the first frame and is Mouse's now.
      push.mockClear();
      fireEvent.click(overlay, ringPoint(75));
      expect(push).toHaveBeenCalledExactlyOnceWith("/genomes?host=Mouse");

      // At -30° the hidden Human is painted over Bat, which takes the click.
      push.mockClear();
      fireEvent.click(overlay, ringPoint(-30));
      expect(push).toHaveBeenCalledExactlyOnceWith("/genomes?host=Bat");

      // -60° shows only the hidden Human, though it ends up Bat's.
      push.mockClear();
      fireEvent.click(overlay, ringPoint(-60));
      expect(push).not.toHaveBeenCalled();

      act(() => {
        held.update?.(1);
        held.complete?.();
      });
      fireEvent.click(overlay, ringPoint(45));
      expect(push).toHaveBeenCalledExactlyOnceWith("/genomes?host=Mouse");
    });

    it("exposes each slice as a link followed with Enter", () => {
      render(<DonutChart title="Host" data={linked} />);

      const group = screen.getByRole("group", { name: "Host distribution" });
      const bat = within(group).getByRole("link", { name: "Bat: 10" });
      expect(bat).toHaveAttribute("tabindex", "0");

      fireEvent.focus(bat);
      expect(screen.getByRole("status")).toHaveTextContent("Bat: 10");

      fireEvent.keyDown(bat, { key: "Enter" });
      expect(push).toHaveBeenCalledWith("/genomes?host=Bat");
    });

    it("never links the Others bucket", () => {
      render(
        <DonutChart
          title="Host"
          data={Array.from({ length: 11 }, (_, index) => ({
            label: `Host ${String(index)}`,
            value: 20 - index,
            href: `/genomes?host=${String(index)}`,
          }))}
        />,
      );

      expect(screen.getAllByRole("link")).toHaveLength(9);
      const others = screen.getByRole("graphics-symbol", { name: "Others: 21" });
      expect(others).not.toHaveAttribute("tabindex");
    });

    it("stays an image without links", () => {
      render(<DonutChart title="Host" data={[{ label: "Human", value: 30 }]} />);
      mockSvgRect();
      const overlay = screen.getByTestId("chart-overlay");

      fireEvent.mouseMove(overlay, onHuman);
      fireEvent.click(overlay, onHuman);

      expect(screen.getByRole("img", { name: "Host distribution" })).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(overlay).not.toHaveClass("cursor-pointer");
      expect(push).not.toHaveBeenCalled();
    });
  });
});
