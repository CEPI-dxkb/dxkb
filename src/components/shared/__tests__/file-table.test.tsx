import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import {
  DataTable,
  type FileTableFeatures,
  useDataTableBody,
} from "../file-table";

interface Row {
  id: string;
  name: string;
  size: number;
}
const rows: Row[] = [{ id: "1", name: "alpha", size: 1 }];
const columns: ColumnDef<FileTableFeatures, Row>[] = [
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "size", header: "Size", accessorKey: "size" },
];

const storageKey = "dxkb-table-layout:v1:test-files";

// jsdom has no pointer capture.
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

/** A pointer drag of `handle` by `deltaX` px from `startX`, released. */
function pointerDrag(
  handle: HTMLElement,
  startX: number,
  deltaX: number,
  pointerType: "mouse" | "touch" = "mouse",
) {
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    button: 0,
    isPrimary: true,
    pointerType,
    clientX: startX,
  });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: startX + deltaX });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: startX + deltaX });
}

function Body() {
  const { rows: tableRows } = useDataTableBody<Row>();
  return tableRows.map((row) => (
    <tr key={row.id}>
      <td>{row.original.name}</td>
    </tr>
  ));
}

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

function renderTable() {
  return render(
    <DataTable<Row>
      data={rows}
      columns={columns}
      defaultColumnOrder={["name", "size"]}
      isLoading={false}
      getRowId={(row) => row.id}
      sort={{ field: "name", direction: "asc" }}
      onSort={vi.fn()}
      layoutKey="test-files"
    >
      <Body />
    </DataTable>,
  );
}

function storedLayout(): unknown {
  return JSON.parse(localStorage.getItem(storageKey) ?? "null");
}

describe("FileTable remembered layout", () => {
  it("restores the saved column order", () => {
    localStorage.setItem(storageKey, JSON.stringify({ order: ["size", "name"] }));
    renderTable();
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toStrictEqual([
      expect.stringContaining("Size"),
      expect.stringContaining("Name"),
    ]);
  });

  it("saves a keyboard resize and forgets a width reset by double-click", () => {
    localStorage.setItem(storageKey, JSON.stringify({ widths: { name: 300 } }));
    renderTable();
    const handle = screen.getByRole("separator", {
      name: /resize name column/i,
    });
    expect(handle).toHaveAttribute("aria-valuenow", "300");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(storedLayout()).toStrictEqual({ widths: { name: 310 } });

    fireEvent.doubleClick(handle);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("keeps the other saved widths when one column's width is reset", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ widths: { name: 300, size: 120 } }),
    );
    renderTable();
    fireEvent.doubleClick(
      screen.getByRole("separator", { name: /resize name column/i }),
    );
    expect(storedLayout()).toStrictEqual({ widths: { size: 120 } });
  });

  // TanStack stores the raw drag width (0 when dragged far left, unbounded to the
  // right) and only getSize() clamps it to the column's minSize/maxSize. What is
  // saved must be what the column renders at: a width outside the saved-layout
  // schema (20-4000) would cost the user every saved width.
  describe("a pointer drag past the column's limits", () => {
    function dragName(savedWidth: number, deltaX: number) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          order: ["size", "name"],
          widths: { name: savedWidth },
        }),
      );
      renderTable();
      const handle = screen.getByRole("separator", {
        name: /resize name column/i,
      });
      pointerDrag(handle, 1000, deltaX);
      return handle;
    }

    it("saves the maximum width, not the raw one", async () => {
      const handle = dragName(900, 3200);
      await waitFor(() => {
        expect(storedLayout()).toStrictEqual(
          expect.objectContaining({ widths: { name: 1000 } }),
        );
      });
      expect(handle).toHaveAttribute("aria-valuenow", "1000");
    });

    it("saves the minimum width, not the raw one", async () => {
      const handle = dragName(333, -400);
      await waitFor(() => {
        expect(storedLayout()).toStrictEqual(
          expect.objectContaining({ widths: { name: 40 } }),
        );
      });
      expect(handle).toHaveAttribute("aria-valuenow", "40");
    });

    it("keeps the saved column order", async () => {
      dragName(900, 3200);
      await waitFor(() => {
        expect(storedLayout()).toStrictEqual({
          order: ["size", "name"],
          widths: { name: 1000 },
        });
      });
      expect(
        screen.getAllByRole("columnheader").map((cell) => cell.textContent),
      ).toStrictEqual([
        expect.stringContaining("Size"),
        expect.stringContaining("Name"),
      ]);
    });
  });

  describe("after a saved resize, another tab's width change", () => {
    function otherTabWrites(layout: unknown) {
      act(() => {
        if (layout === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify(layout));
        window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
      });
    }

    function resizeNameWithKeyboard() {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ widths: { name: 300, size: 120 } }),
      );
      renderTable();
      fireEvent.keyDown(
        screen.getByRole("separator", { name: /resize name column/i }),
        { key: "ArrowRight" },
      );
      expect(storedLayout()).toStrictEqual({ widths: { name: 310, size: 120 } });
    }

    it("shows for the column this tab resized", () => {
      resizeNameWithKeyboard();
      otherTabWrites({ widths: { name: 500, size: 120 } });
      expect(
        screen.getByRole("separator", { name: /resize name column/i }),
      ).toHaveAttribute("aria-valuenow", "500");
    });

    it("shows for a column this tab did not resize", () => {
      resizeNameWithKeyboard();
      otherTabWrites({ widths: { name: 310, size: 200 } });
      expect(
        screen.getByRole("separator", { name: /resize size column/i }),
      ).toHaveAttribute("aria-valuenow", "200");
    });

    it("shows a reset of every width", () => {
      resizeNameWithKeyboard();
      otherTabWrites(null);
      expect(
        screen.getByRole("separator", { name: /resize name column/i }),
      ).toHaveAttribute("aria-valuenow", "150");
    });
  });

  it("saves an ordinary pointer drag once, on release", async () => {
    localStorage.setItem(storageKey, JSON.stringify({ widths: { name: 300 } }));
    renderTable();
    const handle = screen.getByRole("separator", {
      name: /resize name column/i,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
      clientX: 100,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 120 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "350");
    });
    // Mid-drag the width lives in component state only.
    expect(storedLayout()).toStrictEqual({ widths: { name: 300 } });

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });
    await waitFor(() => {
      expect(storedLayout()).toStrictEqual({ widths: { name: 350 } });
    });
  });

  it("ends a cancelled drag without saving it", () => {
    localStorage.setItem(storageKey, JSON.stringify({ widths: { name: 300 } }));
    renderTable();
    const handle = screen.getByRole("separator", {
      name: /resize name column/i,
    });
    const header = screen.getByRole("columnheader", { name: /Name/ });
    const region = screen.getByRole("region", { name: "Data table" });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      pointerType: "touch",
      clientX: 100,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    expect(handle).toHaveAttribute("aria-valuenow", "350");
    expect(header.style.getPropertyValue("--col-size")).toBe("350px");
    expect(region).toHaveClass("cursor-col-resize");

    fireEvent.pointerCancel(handle, { pointerId: 1, isPrimary: true });
    expect(storedLayout()).toStrictEqual({ widths: { name: 300 } });
    expect(region).not.toHaveClass("cursor-col-resize");
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    expect(header.style.getPropertyValue("--col-size")).toBe("300px");
  });

  it("merges a keyboard resize into the widths stored when it is saved", () => {
    // Writes another tab's save after the table renders the resize but before
    // its commit effect runs: a layout effect runs between the two, and a
    // direct write sends no storage event, so the table's render-time layout
    // is stale when the effect saves.
    let foreignWrite: string | null = null;
    function OwnerHeader() {
      useLayoutEffect(() => {
        if (foreignWrite === null) return;
        localStorage.setItem(storageKey, foreignWrite);
        foreignWrite = null;
      });
      return "Owner";
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify({ widths: { name: 300, size: 120 } }),
    );
    render(
      <DataTable<Row>
        data={rows}
        columns={[...columns, { id: "owner", header: () => <OwnerHeader /> }]}
        defaultColumnOrder={["name", "size", "owner"]}
        isLoading={false}
        getRowId={(row) => row.id}
        sort={{ field: "name", direction: "asc" }}
        onSort={vi.fn()}
        layoutKey="test-files"
      >
        <Body />
      </DataTable>,
    );
    foreignWrite = JSON.stringify({ widths: { name: 300, size: 200 } });
    fireEvent.keyDown(
      screen.getByRole("separator", { name: /resize name column/i }),
      { key: "ArrowRight" },
    );
    expect(foreignWrite).toBeNull();
    expect(storedLayout()).toStrictEqual({ widths: { name: 310, size: 200 } });
  });

  it("saves a touch drag on release", () => {
    localStorage.setItem(storageKey, JSON.stringify({ widths: { name: 300 } }));
    renderTable();
    pointerDrag(
      screen.getByRole("separator", { name: /resize name column/i }),
      100,
      40,
      "touch",
    );
    expect(storedLayout()).toStrictEqual({ widths: { name: 340 } });
  });

  // Responsive tables hide columns with CSS (`hidden md:table-cell`), which
  // TanStack still counts as visible. jsdom loads no stylesheet, so these
  // tests hide the Owner header inline, and give the scroll box a width so the
  // columns after the dragged one share the drag.
  describe("with a column that CSS hides", () => {
    const threeColumns: ColumnDef<FileTableFeatures, Row>[] = [
      ...columns,
      { id: "owner", header: "Owner", accessorFn: () => "me" },
    ];

    function renderThreeColumns() {
      const view = render(
        <DataTable<Row>
          data={rows}
          columns={threeColumns}
          defaultColumnOrder={["name", "size", "owner"]}
          isLoading={false}
          getRowId={(row) => row.id}
          sort={{ field: "name", direction: "asc" }}
          onSort={vi.fn()}
          layoutKey="test-files"
        >
          <Body />
        </DataTable>,
      );
      Object.defineProperty(
        screen.getByRole("region", { name: "Data table" }),
        "clientWidth",
        { configurable: true, value: 600 },
      );
      screen.getByRole("columnheader", { name: /Owner/ }).style.display =
        "none";
      return view;
    }

    function pressName(pointerType: "mouse" | "touch" = "mouse") {
      const handle = screen.getByRole("separator", {
        name: /resize name column/i,
      });
      fireEvent.pointerDown(handle, {
        pointerId: 1,
        button: 0,
        isPrimary: true,
        pointerType,
        clientX: 100,
      });
      return handle;
    }

    it("leaves the hidden column out of a drag", () => {
      renderThreeColumns();
      const handle = pressName();
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 160 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
      // Name and Size fill 600px at twice their 150px settings: Name's edge
      // moves 60px (30 setting px) and Size gives the width up.
      expect(storedLayout()).toStrictEqual({
        widths: { name: 180, size: 120 },
      });
    });

    it("ignores a second finger and keeps widths another tab saved mid-drag", () => {
      renderThreeColumns();
      const handle = pressName("touch");
      // A second finger neither starts a drag of its own nor ends this one.
      fireEvent.pointerDown(
        screen.getByRole("separator", { name: /resize size column/i }),
        { pointerId: 2, isPrimary: false, pointerType: "touch", clientX: 300 },
      );
      fireEvent.pointerUp(handle, { pointerId: 2 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 160 });
      expect(localStorage.getItem(storageKey)).toBeNull();
      // Owner is hidden, so this drag does not change it.
      localStorage.setItem(storageKey, JSON.stringify({ widths: { owner: 90 } }));
      fireEvent.pointerUp(handle, { pointerId: 1 });
      expect(storedLayout()).toStrictEqual({
        widths: { owner: 90, name: 180, size: 120 },
      });
    });

    it("drops a drag, saving nothing, when the table unmounts mid-drag", () => {
      localStorage.setItem(storageKey, JSON.stringify({ widths: { size: 200 } }));
      const { unmount } = renderThreeColumns();
      const handle = pressName();
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 160 });
      // The drag is live (Size gives up what Name takes).
      expect(handle).toHaveAttribute("aria-valuenow", "185");
      unmount();
      fireEvent.pointerUp(document, { pointerId: 1 });
      fireEvent.mouseUp(document);
      fireEvent.touchEnd(document);
      expect(storedLayout()).toStrictEqual({ widths: { size: 200 } });
    });
  });
});
