import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { renderToolbar } from "./fixtures/toolbar-harness";

stubMenuLayout();

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("listbox", { name: "Facets" });
}

const facetList = () => screen.getByRole("listbox", { name: "Facets" });
const leftSearch = () =>
  screen.getByRole("combobox", { name: "Find a facet or value" });
const groupNamed = (name: string) =>
  within(facetList()).getByRole("group", { name });
/** The right pane's checklist, by its facet's label. */
const valueList = (label: string) =>
  screen.getByRole("listbox", { name: `${label} values` });

describe("FiltersMenu groups", () => {
  it("lists active facets, then the pinned set, then a folded More group", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { host_name: ["Human"] } });
    await openFilters(user);

    expect(
      within(groupNamed("Active")).getByRole("option", {
        name: "Host Name: Human, pinned",
      }),
    ).toBeInTheDocument();
    expect(
      within(groupNamed("Facets")).getByRole("option", {
        name: "Genome Status, pinned",
      }),
    ).toBeInTheDocument();

    const more = screen.getByRole("option", { name: "Show 2 more facets" });
    expect(more).toHaveTextContent("More2Show all");
    expect(
      screen.queryByRole("option", { name: "Isolation Country" }),
    ).not.toBeInTheDocument();

    // The first active facet is the one shown on the right.
    expect(valueList("Host Name")).toBeInTheDocument();
  });

  it("unfolds and folds the More group from its header", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));

    const header = screen.getByRole("option", { name: "Hide 2 more facets" });
    expect(header).toHaveTextContent("Show less");
    const moreGroup = within(facetList()).getByRole("group", {
      name: "More facets",
    });
    expect(
      within(moreGroup)
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["Isolation Country", "Species"]);

    await user.click(header);

    expect(
      screen.getByRole("option", { name: "Show 2 more facets" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Isolation Country" }),
    ).not.toBeInTheDocument();
  });

  it("drops the group headings when the pinned facets are all there is", async () => {
    const user = userEvent.setup();
    renderToolbar({ pinned: toolbarFields() });
    await openFilters(user);

    expect(
      within(facetList()).queryByRole("group"),
    ).not.toBeInTheDocument();
    expect(within(facetList()).getAllByRole("option")).toHaveLength(4);
  });

  it("unfolds More while searching, so a facet outside the set is found", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "spec");

    expect(screen.getByRole("option", { name: "Species" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /more facets?$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Genome Status, pinned" }),
    ).not.toBeInTheDocument();
    // The first match is highlighted; More is not counted, so the pane waits
    // for a click rather than starting a read.
    expect(screen.getByRole("option", { name: "Species" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(
      screen.queryByRole("listbox", { name: "Species values" }),
    ).not.toBeInTheDocument();
  });

  it("says so when nothing matches the search", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "zzz");

    expect(within(facetList()).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nothing matches “zzz”")).toBeInTheDocument();
  });
});

describe("FiltersMenu value search", () => {
  it("finds values in loaded counts and seeds the facet's own search", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    // Counts the More facets, so their values are in loaded counts.
    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));

    await user.type(leftSearch(), "germ");

    const values = groupNamed("Values in loaded counts");
    const germany = within(values).getByRole("option", {
      name: "Isolation Country: Germany",
    });
    expect(germany).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("combobox", { name: "Filter Isolation Country values" }),
    ).toHaveValue("germ");
    expect(
      within(valueList("Isolation Country"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Germany7"]);

    await user.click(germany);

    expect(spies.toggleValue).toHaveBeenCalledWith(
      "isolation_country",
      "Germany",
    );
    expect(
      screen.getByRole("option", { name: "Isolation Country: Germany" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("matches values only from two letters on", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "w");

    expect(
      within(facetList()).queryByRole("group", {
        name: "Values in loaded counts",
      }),
    ).not.toBeInTheDocument();

    await user.type(leftSearch(), "g");

    expect(
      screen.getByRole("option", { name: "Genome Status: WGS" }),
    ).toBeInTheDocument();
  });
});

describe("FiltersMenu counting", () => {
  it("counts the active facets outside the pinned set when the menu opens", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: { isolation_country: ["Germany"] },
    });

    await openFilters(user);

    expect(spies.onFacetsWanted).toHaveBeenCalled();
    expect(spies.setPeekedFields).toHaveBeenCalledOnce();
    expect(spies.setPeekedFields).toHaveBeenCalledWith(
      new Set(["isolation_country"]),
    );
  });

  it("counts nothing outside the pinned set until More is unfolded, then all of it at once", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    expect(spies.onFacetsWanted).toHaveBeenCalled();
    expect(spies.setPeekedFields).not.toHaveBeenCalled();

    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));

    expect(spies.setPeekedFields).toHaveBeenCalledOnce();
    expect(spies.setPeekedFields).toHaveBeenCalledWith(
      new Set(["isolation_country", "species"]),
    );

    await user.click(screen.getByRole("option", { name: "Species" }));

    expect(spies.setPeekedFields).toHaveBeenCalledOnce();
    expect(valueList("Species")).toBeInTheDocument();
    // Counting: the checklist waits on skeleton rows.
    expect(valueList("Species")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading values…")).toBeInTheDocument();
  });

  it("switches the pane on hover once More is counted", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));

    fireEvent.mouseMove(screen.getByRole("option", { name: "Species" }), {
      clientX: 40,
      clientY: 120,
    });

    expect(valueList("Species")).toBeInTheDocument();
  });

  it("only highlights a More facet a search lists while More is folded, and counts More when it is opened", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "spec");
    const species = screen.getByRole("option", { name: "Species" });
    fireEvent.mouseMove(species, { clientX: 40, clientY: 120 });

    expect(species).toHaveAttribute("data-active", "true");
    expect(spies.setPeekedFields).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("listbox", { name: "Species values" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(spies.setPeekedFields).toHaveBeenCalledWith(
      new Set(["isolation_country", "species"]),
    );
    expect(valueList("Species")).toBeInTheDocument();
  });

  it("ignores a row moving under a still pointer, as unfolding More scrolls the list", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));
    fireEvent.mouseMove(
      screen.getByRole("option", { name: "Genome Status, pinned" }),
      { clientX: 40, clientY: 60 },
    );

    // WebKit reports the row now under the pointer with the same position.
    fireEvent.mouseMove(screen.getByRole("option", { name: "Species" }), {
      clientX: 40,
      clientY: 60,
    });

    expect(valueList("Genome Status")).toBeInTheDocument();
  });

  it("drops the unfiltered More counts when the menu closes and keeps a filtered one", async () => {
    const user = userEvent.setup();
    const { state } = renderToolbar();
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));
    await user.click(screen.getByRole("option", { name: "Isolation Country" }));
    await user.click(
      within(valueList("Isolation Country")).getByRole("option", {
        name: /^France/,
      }),
    );
    expect(state.peeked).toEqual(new Set(["isolation_country", "species"]));

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(state.peeked).toEqual(new Set(["isolation_country"]));
    });
  });
});

describe("FiltersMenu pinning", () => {
  it("pins a More facet from its row without moving it while the menu is open", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 2 more facets" }));
    const row = screen.getByRole("option", { name: "Species" });

    await user.click(within(row).getByTitle("Pin to keep this facet in your set"));

    expect(spies.setFieldPinned).toHaveBeenCalledWith("species", true);
    const moreGroup = within(facetList()).getByRole("group", {
      name: "More facets",
    });
    expect(
      within(moreGroup).getByRole("option", { name: "Species, pinned" }),
    ).toBeInTheDocument();

    // Reopened, it is listed with the pinned set.
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("listbox", { name: "Facets" }),
      ).not.toBeInTheDocument();
    });
    await openFilters(user);
    expect(
      within(groupNamed("Facets")).getByRole("option", {
        name: "Species, pinned",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Show 1 more facet" }),
    ).toBeInTheDocument();
  });

  it("toggles the shown facet's pin from the pane header", async () => {
    const user = userEvent.setup();
    const { spies, state } = renderToolbar();
    await openFilters(user);
    const pin = screen.getByRole("button", { name: "Pinned" });
    expect(pin).toHaveAttribute("aria-pressed", "true");

    await user.click(pin);

    expect(spies.setFieldPinned).toHaveBeenLastCalledWith("genome_status", false);
    expect(screen.getByRole("button", { name: "Pin" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Still counted (as a peek) and still in its place until the menu closes.
    expect(state.peeked).toEqual(new Set(["genome_status"]));
    expect(
      within(groupNamed("Facets")).getByRole("option", { name: "Genome Status" }),
    ).toBeInTheDocument();
    expect(valueList("Genome Status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pin" }));

    expect(spies.setFieldPinned).toHaveBeenLastCalledWith("genome_status", true);
    expect(state.peeked).toEqual(new Set());
    expect(screen.getByRole("button", { name: "Pinned" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("FiltersMenu keyboard", () => {
  it("moves through the rows with the arrows, switching the pane", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    const search = leftSearch();
    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}");

    const host = screen.getByRole("option", { name: "Host Name, pinned" });
    expect(search).toHaveAttribute("aria-activedescendant", host.id);
    expect(valueList("Host Name")).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");

    expect(search).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Genome Status, pinned" }).id,
    );
    expect(valueList("Genome Status")).toBeInTheDocument();
  });

  it("folds More with Enter and Space on its header", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    await waitFor(() => {
      expect(leftSearch()).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(leftSearch()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Show 2 more facets" }).id,
    );

    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("option", { name: "Hide 2 more facets" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Species" })).toBeInTheDocument();

    await user.keyboard(" ");
    expect(
      screen.getByRole("option", { name: "Show 2 more facets" }),
    ).toBeInTheDocument();
    // Space folded the group rather than typing into the search.
    expect(leftSearch()).toHaveValue("");
  });

  it("moves into the checklist with → or Enter and back with ←", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    await waitFor(() => {
      expect(leftSearch()).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");

    const right = screen.getByRole("combobox", {
      name: "Filter Genome Status values",
    });
    expect(right).toHaveFocus();

    // The checklist's own arrows and Enter pick a value.
    await user.keyboard("{ArrowDown}{Enter}");
    expect(spies.toggleValue).toHaveBeenCalledWith("genome_status", "Complete");

    await user.keyboard("{ArrowLeft}");
    expect(leftSearch()).toHaveFocus();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(
      screen.getByRole("combobox", { name: "Filter Host Name values" }),
    ).toHaveFocus();

    // Backspace in an empty checklist search also returns to the facets.
    await user.keyboard("{Backspace}");
    expect(leftSearch()).toHaveFocus();
  });

  it("focuses the new checklist when Enter or → opens an uncounted facet", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    await waitFor(() => {
      expect(leftSearch()).toHaveFocus();
    });

    // A search lists Species while More is folded, so it is only highlighted
    // and the pane still shows Genome Status: Enter replaces the checklist.
    await user.type(leftSearch(), "spec");
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("combobox", { name: "Filter Species values" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    await user.clear(leftSearch());
    await user.type(leftSearch(), "isol");
    // Counted now, so the highlight has already switched the pane; → keeps it.
    await user.keyboard("{ArrowRight}");

    expect(
      screen.getByRole("combobox", { name: "Filter Isolation Country values" }),
    ).toHaveFocus();
  });

  it("toggles a matched value with Enter", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "fran");
    // The first row is the matched value (no facet label matches).
    await user.keyboard("{Enter}");

    expect(spies.toggleValue).toHaveBeenCalledWith("isolation_country", "France");
  });
});

describe("FiltersMenu checklist", () => {
  it("lists a selected value the counts no longer have, and shows '' as (empty)", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { host_name: ["Mouse"] } });
    await openFilters(user);

    expect(
      within(valueList("Host Name"))
        .getAllByRole("option")
        .map((option) => [option.textContent, option.getAttribute("aria-selected")]),
    ).toEqual([
      ["Mouse—", "true"],
      ["Human5", "false"],
      ["(empty)2", "false"],
    ]);
  });

  it("says a facet's results have no values", async () => {
    const user = userEvent.setup();
    renderToolbar({ facets: { genome_status: [] } });
    await openFilters(user);

    expect(
      within(valueList("Genome Status")).getByText("No values in these results"),
    ).toBeInTheDocument();
  });

  it("says when the checklist search matches nothing, and clears it", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    const search = screen.getByRole("combobox", {
      name: "Filter Genome Status values",
    });

    await user.type(search, "zz");

    expect(
      screen.getByText("No genome status matches “zz”"),
    ).toBeInTheDocument();
    expect(screen.getByText("3 values are listed; try fewer letters.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(search).toHaveValue("");
    expect(within(valueList("Genome Status")).getAllByRole("option")).toHaveLength(3);
  });

  it("picks several values in one facet with the menu open, then clears them", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    const list = valueList("Genome Status");

    await user.click(within(list).getByRole("option", { name: /^WGS/ }));
    await user.click(within(list).getByRole("option", { name: /^Plasmid/ }));

    expect(
      within(list)
        .getAllByRole("option", { selected: true })
        .map((option) => option.textContent),
    ).toEqual(["WGS20", "Plasmid3"]);
    expect(
      screen.getByRole("button", { name: "Filters, 1 active" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear 2 Genome Status values" }),
    );

    expect(spies.setFieldValues).toHaveBeenLastCalledWith("genome_status", []);
    expect(within(list).queryAllByRole("option", { selected: true })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Clear Genome Status" })).toBeDisabled();
  });

  it("shows a quiet note instead of counts for a filter no facet names", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { strain: ["K-12"] } });
    await openFilters(user);

    expect(
      within(groupNamed("Active")).getByRole("option", { name: "strain: K-12" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This filter has no facet, so its values are not counted."),
    ).toBeInTheDocument();
    // Nothing to pin: no facet stands behind it.
    expect(screen.queryByRole("button", { name: /^Pin/ })).not.toBeInTheDocument();
  });
});

function toolbarFields() {
  return ["genome_status", "host_name", "isolation_country", "species"];
}
