import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DBStatisticsSkeleton from "@/components/statistics/db-statistics-skeleton";

describe("DBStatisticsSkeleton", () => {
  it("renders 8 placeholder cells inside the same outer wrapper as the real section", () => {
    const { container } = render(<DBStatisticsSkeleton />);

    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section?.className).toContain("py-12");
    expect(section?.className).toContain("bg-primary");

    const grid = container.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(grid?.className).toContain("grid-cols-2");
    expect(grid?.className).toContain("lg:grid-cols-4");

    const placeholders = container.querySelectorAll('[data-testid="db-statistics-skeleton-cell"]');
    expect(placeholders).toHaveLength(8);
  });

  it("preserves the section heading so the layout matches the real component", () => {
    const { getByText } = render(<DBStatisticsSkeleton />);
    expect(getByText("Database Statistics")).toBeInTheDocument();
  });
});
