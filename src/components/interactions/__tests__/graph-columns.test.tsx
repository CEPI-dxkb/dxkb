import { fireEvent, render, screen } from "@testing-library/react";
import type { MockInstance } from "vitest";

import {
  panelShares,
  pressOnSeparator,
  stubResizableGeometry,
} from "@/test-helpers/resizable";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { GraphColumns } from "../graph-columns";

/** Real `react-resizable-panels`: a stub that echoed props would hide how widths are restored and saved. */
stubResizableGeometry(1000);

function renderColumns(
  columns?: { list: number; details: number },
  cookieSpy: MockInstance<(value: string) => void> = vi.spyOn(
    document,
    "cookie",
    "set",
  ),
) {
  render(
    <GraphColumns
      list={<span>List</span>}
      canvas={<span>Canvas</span>}
      details={<span>Details</span>}
    />,
    {
      wrapper: createUiPreferencesWrapper(
        columns ? { interactionsGraphColumns: columns } : undefined,
      ),
    },
  );
  return cookieSpy;
}

function savedColumns(cookieSpy: MockInstance<(value: string) => void>) {
  const writes = cookieSpy.mock.calls
    .map(([value]) => value)
    .filter((value) => value.startsWith("dxkb-interactions-graph-columns="));
  const last = writes.at(-1);
  if (!last) return null;
  return JSON.parse(decodeURIComponent(last.split("=")[1].split(";")[0])) as {
    list: number;
    details: number;
  };
}

describe("GraphColumns", () => {
  it("draws the three slots with a labelled handle between each pair", () => {
    renderColumns();

    for (const text of ["List", "Canvas", "Details"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("separator", { name: "Resize the protein list" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize the selection details" }),
    ).toBeInTheDocument();
  });

  it("opens each side column at its saved pixel width", () => {
    renderColumns({ list: 300, details: 400 });

    // The helper's geometry fixes no group width, so compare the columns with each other: 300px
    // against 400px, and the canvas takes the rest.
    const [list, canvas, details] = panelShares().map(Number);
    expect(list / details).toBeCloseTo(300 / 400);
    expect(canvas).toBeGreaterThan(details);
  });

  it("saves both widths after the user resizes a column", () => {
    const cookieSpy = renderColumns({ list: 300, details: 400 });
    expect(savedColumns(cookieSpy)).toBeNull();

    pressOnSeparator("ArrowRight", 0);

    const saved = savedColumns(cookieSpy);
    expect(saved).toEqual({
      list: expect.any(Number) as number,
      details: expect.any(Number) as number,
    });
  });

  it("restores a column's default width on a double-click and saves it", () => {
    const cookieSpy = renderColumns({ list: 300, details: 400 });

    fireEvent.doubleClick(
      screen.getByRole("separator", { name: "Resize the protein list" }),
    );

    expect(savedColumns(cookieSpy)).toEqual({ list: 240, details: 400 });
    const [list, , details] = panelShares().map(Number);
    expect(list / details).toBeCloseTo(240 / 400);
  });
});
