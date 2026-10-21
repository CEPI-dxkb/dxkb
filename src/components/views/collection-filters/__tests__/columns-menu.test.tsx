import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { ColumnsMenu } from "../columns-menu";
import type { CollectionColumnControls, CollectionColumnOption } from "../types";

stubMenuLayout();

/** The default layout: Host is hidden between two shown columns. */
const defaultColumns: CollectionColumnOption[] = [
  ["genome_id", "Genome ID", true],
  ["host", "Host", false],
  ["genome_name", "Genome Name", true],
  ["strain", "Strain", true],
  ["country", "Country", false],
].map(([id, label, visible], index) => ({
  id: String(id),
  label: String(label),
  visible: Boolean(visible),
  defaultVisible: Boolean(visible),
  defaultIndex: index,
}));

type ColumnChange = Parameters<CollectionColumnControls["setColumns"]>[0];

/** The menu over a real layout: each write is applied, and spied on. */
function renderColumnsMenu(initial: CollectionColumnOption[] = defaultColumns) {
  const setColumns = vi.fn<(change: ColumnChange) => void>();
  const resetColumns = vi.fn<() => void>();

  function Harness() {
    const [columns, setState] = useState(initial);
    return (
      <ColumnsMenu
        columns={columns}
        setColumns={(change) => {
          setColumns(change);
          setState((current) => {
            const visible = current.map((column) => ({
              ...column,
              visible: change.visibility?.[column.id] ?? column.visible,
            }));
            const { order } = change;
            if (!order) return visible;
            return order.map(
              (id) => visible.find((column) => column.id === id) ?? visible[0],
            );
          });
        }}
        resetColumns={() => {
          resetColumns();
          setState(defaultColumns);
        }}
      />
    );
  }

  render(<Harness />);
  return { setColumns, resetColumns };
}

async function openColumns(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Columns/ }));
  const search = await screen.findByRole("combobox", { name: "Find a column" });
  await waitFor(() => {
    expect(search).toHaveFocus();
  });
  return search;
}

const labelsIn = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("option")
    .map((option) => option.getAttribute("aria-label"));

const footerButton = (name: string) => screen.getByRole("button", { name });

async function expectAnnouncement(message: string) {
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(message);
  });
}

describe("ColumnsMenu", () => {
  it("lists shown columns in display order and hidden ones A–Z", async () => {
    const user = userEvent.setup();
    renderColumnsMenu();
    expect(
      screen.getByRole("button", { name: "Columns, 3 of 5 shown" }),
    ).toHaveTextContent("Columns3/5");

    await openColumns(user);

    expect(labelsIn("Shown")).toEqual([
      "Genome ID, shown, position 1 of 3",
      "Genome Name, shown, position 2 of 3",
      "Strain, shown, position 3 of 3",
    ]);
    expect(labelsIn("Hidden")).toEqual(["Country, hidden", "Host, hidden"]);
  });

  it("hides a shown column on click", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);

    await user.click(
      screen.getByRole("option", { name: "Strain, shown, position 3 of 3" }),
    );

    expect(setColumns).toHaveBeenCalledWith({ visibility: { strain: false } });
    expect(labelsIn("Hidden")).toEqual([
      "Country, hidden",
      "Host, hidden",
      "Strain, hidden",
    ]);
    await expectAnnouncement("Strain hidden. 2 columns shown.");
    expect(
      screen.getByRole("button", { name: "Columns, 2 of 5 shown, customised" }),
    ).toBeInTheDocument();
  });

  it("shows a hidden column at the end of the shown order", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);

    await user.click(screen.getByRole("option", { name: "Host, hidden" }));

    // Host leaves its default slot (second) for the end of the shown run;
    // the hidden Country keeps its slot.
    expect(setColumns).toHaveBeenCalledWith({
      visibility: { host: true },
      order: ["genome_id", "genome_name", "strain", "host", "country"],
    });
    expect(labelsIn("Shown").at(-1)).toBe("Host, shown, position 4 of 4");
    await expectAnnouncement("Host shown at position 4 of 4.");
  });

  it("keeps one column shown", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu(
      defaultColumns.map((column) => ({
        ...column,
        visible: column.id === "strain",
      })),
    );
    await openColumns(user);

    await user.click(
      screen.getByRole("option", { name: "Strain, shown, position 1 of 1" }),
    );

    expect(setColumns).not.toHaveBeenCalled();
    await expectAnnouncement("At least one column stays shown.");
  });

  it("moves through the rows with the arrows and toggles one with Enter", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    const search = await openColumns(user);

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    expect(search).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Country, hidden" }).id,
    );

    await user.keyboard("{Enter}");

    expect(setColumns).toHaveBeenCalledWith({
      visibility: { country: true },
      order: ["genome_id", "host", "genome_name", "strain", "country"],
    });
  });

  it("reorders a shown column with Alt+↑/↓, writing the whole order", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);
    expect(footerButton("Reset to default")).toBeDisabled();

    await user.keyboard("{ArrowDown}{Alt>}{ArrowUp}{/Alt}");

    // Genome Name moves up past Genome ID; hidden columns keep their slots.
    expect(setColumns).toHaveBeenLastCalledWith({
      order: ["genome_name", "host", "genome_id", "strain", "country"],
    });
    expect(labelsIn("Shown")).toEqual([
      "Genome Name, shown, position 1 of 3",
      "Genome ID, shown, position 2 of 3",
      "Strain, shown, position 3 of 3",
    ]);
    await expectAnnouncement("Genome Name moved to position 1 of 3.");

    await user.keyboard("{Alt>}{ArrowDown}{ArrowDown}{/Alt}");

    expect(setColumns).toHaveBeenLastCalledWith({
      order: ["genome_id", "host", "strain", "genome_name", "country"],
    });
    expect(labelsIn("Shown").at(-1)).toBe("Genome Name, shown, position 3 of 3");

    // Only the order differs from the default, and that counts as customised.
    expect(
      screen.getByRole("button", { name: "Columns, 3 of 5 shown, customised" }),
    ).toBeInTheDocument();
    expect(footerButton("Reset to default")).toBeEnabled();
  });

  it("says why a column cannot move", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);

    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expectAnnouncement("Genome ID is already first.");

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Alt>}{ArrowDown}{/Alt}");
    await expectAnnouncement("Show the column first to reorder it.");

    await user.type(screen.getByRole("combobox", { name: "Find a column" }), "ge");
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expectAnnouncement("Clear the search to reorder columns.");

    expect(setColumns).not.toHaveBeenCalled();
  });

  it("reorders by dragging a row's grip", async () => {
    // Rows 32px tall from the list's top; the list itself is 400px.
    const rects = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(
      function (this: Element) {
        const index = (this as HTMLElement).dataset.shownIndex;
        const top = index === undefined ? 0 : Number(index) * 32;
        const height = index === undefined ? 400 : 32;
        return DOMRect.fromRect({ x: 0, y: top, width: 300, height });
      },
    );
    Object.defineProperty(Element.prototype, "setPointerCapture", {
      configurable: true,
      value: () => undefined,
    });
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);
    const grip = within(
      screen.getByRole("option", { name: "Genome ID, shown, position 1 of 3" }),
    ).getByTitle("Drag to reorder");

    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 90 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 90 });

    expect(setColumns).toHaveBeenCalledWith({
      order: ["genome_name", "host", "strain", "genome_id", "country"],
    });
    await expectAnnouncement("Genome ID moved to position 3 of 3.");
    rects.mockRestore();
    Reflect.deleteProperty(Element.prototype, "setPointerCapture");
  });

  it("resets to the default columns and order", async () => {
    const user = userEvent.setup();
    const { resetColumns } = renderColumnsMenu(
      [...defaultColumns].reverse().map((column) => ({ ...column, visible: true })),
    );
    await openColumns(user);

    await user.click(footerButton("Reset to default"));

    expect(resetColumns).toHaveBeenCalledOnce();
    await expectAnnouncement("Columns reset to the default set and order.");
    expect(footerButton("Reset to default")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Columns, 3 of 5 shown" }),
    ).toBeInTheDocument();
  });

  it("shows every column with Show all", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);

    await user.click(footerButton("Show all"));

    expect(setColumns).toHaveBeenCalledWith({
      visibility: {
        genome_id: true,
        host: true,
        genome_name: true,
        strain: true,
        country: true,
      },
    });
    await expectAnnouncement("All 5 columns shown.");
    expect(footerButton("Show all")).toBeDisabled();
  });

  it("keeps only the first shown column with Hide all but first", async () => {
    const user = userEvent.setup();
    const { setColumns } = renderColumnsMenu();
    await openColumns(user);

    await user.click(footerButton("Hide all but first"));

    expect(setColumns).toHaveBeenCalledWith({
      visibility: {
        genome_id: true,
        host: false,
        genome_name: false,
        strain: false,
        country: false,
      },
    });
    await expectAnnouncement("Only Genome ID shown.");
    expect(footerButton("Hide all but first")).toBeDisabled();
  });

  it("filters both lists by the search, which Escape clears first", async () => {
    const user = userEvent.setup();
    renderColumnsMenu();
    const search = await openColumns(user);

    await user.type(search, "genome");

    expect(labelsIn("Shown")).toEqual([
      "Genome ID, shown, position 1 of 3",
      "Genome Name, shown, position 2 of 3",
    ]);
    expect(screen.queryByRole("group", { name: "Hidden" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Shown" })).getByText("2 of 3"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(search).toHaveValue("");
    expect(labelsIn("Hidden")).toHaveLength(2);
  });

  it("says when no column matches, with a way back", async () => {
    const user = userEvent.setup();
    renderColumnsMenu();
    const search = await openColumns(user);

    await user.type(search, "zzz");

    expect(screen.getByText("No column matches “zzz”")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    // The empty state's own button (the search box has an × as well).
    await user.click(
      within(screen.getByRole("listbox", { name: "Columns" })).getByRole(
        "button",
        { name: "Clear search" },
      ),
    );

    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });
});
