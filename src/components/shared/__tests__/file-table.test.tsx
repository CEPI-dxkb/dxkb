import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      fireEvent.mouseDown(handle, { clientX: 1000 });
      fireEvent.mouseMove(document, { clientX: 1000 + deltaX });
      fireEvent.mouseUp(document, { clientX: 1000 + deltaX });
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
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 120 });
    fireEvent.mouseMove(document, { clientX: 150 });
    await waitFor(() => {
      expect(handle).toHaveAttribute("aria-valuenow", "350");
    });
    // Mid-drag the width lives in component state only.
    expect(storedLayout()).toStrictEqual({ widths: { name: 300 } });

    fireEvent.mouseUp(document, { clientX: 150 });
    await waitFor(() => {
      expect(storedLayout()).toStrictEqual({ widths: { name: 350 } });
    });
  });
});
