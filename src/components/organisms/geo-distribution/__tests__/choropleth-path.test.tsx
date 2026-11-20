import { render } from "@testing-library/react";

import { ChoroplethPath } from "../choropleth-path";

function renderPath(fill: string) {
  return render(
    <svg>
      <ChoroplethPath
        pathD="M0 0L10 0L10 10Z"
        fill={fill}
        strokeWidth={1}
        isDraggingRef={{ current: false }}
        payload={{ view: "us", name: "Illinois", count: 3, genera: {}, hosts: {} }}
        onHoverEnter={vi.fn()}
        onHoverLeave={vi.fn()}
      />
    </svg>,
  );
}

describe("ChoroplethPath", () => {
  it("draws one path with a line in its fill's own border color, not scaling with zoom", () => {
    const { container } = renderPath("var(--geo-step-3)");

    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);

    const region = paths.item(0);
    expect(region).toHaveAttribute("d", "M0 0L10 0L10 10Z");
    expect(region).toHaveAttribute("fill", "var(--geo-step-3)");
    expect(region).toHaveAttribute("stroke", "var(--geo-border-3)");
    expect(region).toHaveAttribute("stroke-width", "1");
    expect(region).toHaveAttribute("stroke-linejoin", "round");
    expect(region).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it("draws a region without data with the no-data border", () => {
    const { container } = renderPath("var(--geo-no-data)");

    expect(container.querySelector("path")).toHaveAttribute(
      "stroke",
      "var(--geo-border-no-data)",
    );
  });
});
