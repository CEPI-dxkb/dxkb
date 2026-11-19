import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("restores a column's default width on a double-click", () => {
    renderColumns({ list: 300, details: 400 });

    fireEvent.doubleClick(
      screen.getByRole("separator", { name: "Resize the protein list" }),
    );

    const [list, , details] = panelShares().map(Number);
    expect(list / details).toBeCloseTo(240 / 400);
  });

  describe("saving a reset", () => {
    const original = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth",
    );

    // jsdom has no layout, so the widths the panels report once drawn are staged here: the library
    // has moved the details column too (it would have dropped under its minimum), so the details
    // are not the 400 they had been given.
    function stageDrawnWidths(widths: { list: number; details: number }) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get(this: HTMLElement) {
          if (this.id.endsWith("list")) return widths.list;
          if (this.id.endsWith("details")) return widths.details;
          return 1000;
        },
      });
    }

    afterEach(() => {
      if (original)
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", original);
    });

    it("saves both widths as drawn once the layout has settled, not the default it asked for", async () => {
      const cookieSpy = renderColumns({ list: 300, details: 400 });
      cookieSpy.mockClear();
      stageDrawnWidths({ list: 240, details: 360 });

      fireEvent.doubleClick(
        screen.getByRole("separator", { name: "Resize the protein list" }),
      );
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });

      expect(savedColumns(cookieSpy)).toEqual({ list: 240, details: 360 });
    });

    it("saves a details reset the same way", async () => {
      const cookieSpy = renderColumns({ list: 300, details: 500 });
      cookieSpy.mockClear();
      stageDrawnWidths({ list: 280, details: 256 });

      fireEvent.doubleClick(
        screen.getByRole("separator", { name: "Resize the selection details" }),
      );
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });

      expect(savedColumns(cookieSpy)).toEqual({ list: 280, details: 256 });
    });
  });
});
