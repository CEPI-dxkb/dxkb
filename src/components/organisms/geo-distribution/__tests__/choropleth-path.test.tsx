import { render } from "@testing-library/react";

import { ChoroplethPath } from "../choropleth-path";

describe("ChoroplethPath", () => {
  it("draws a card-colored halo under a core line, neither scaling with zoom", () => {
    const { container } = render(
      <svg>
        <ChoroplethPath
          pathD="M0 0L10 0L10 10Z"
          fill="var(--geo-step-3)"
          strokeWidth={1}
          isDraggingRef={{ current: false }}
          payload={{ view: "us", name: "Illinois", count: 3, genera: {}, hosts: {} }}
          onHoverEnter={vi.fn()}
          onHoverLeave={vi.fn()}
        />
      </svg>,
    );

    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);

    const region = paths.item(0);
    expect(region).toHaveAttribute("fill", "var(--geo-step-3)");
    expect(region).toHaveAttribute("stroke", "var(--geo-border-halo)");
    expect(region).toHaveAttribute("stroke-width", "1.5");
    expect(region).toHaveAttribute("stroke-linejoin", "round");
    expect(region).toHaveAttribute("vector-effect", "non-scaling-stroke");

    const core = paths.item(1);
    expect(core).toHaveAttribute("d", "M0 0L10 0L10 10Z");
    expect(core).toHaveAttribute("fill", "none");
    expect(core).toHaveAttribute("stroke", "var(--geo-border)");
    expect(core).toHaveAttribute("stroke-width", "1");
    expect(core).toHaveAttribute("stroke-linejoin", "round");
    expect(core).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(core).toHaveAttribute("pointer-events", "none");
  });
});
