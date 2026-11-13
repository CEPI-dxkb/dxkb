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
const valueList = (label: string) =>
  screen.getByRole("listbox", { name: `${label} values` });

describe("FiltersMenu groups", () => {
  it("lists active facets, then the favorites, then the other facets", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { host_name: ["Human"] } });
    await openFilters(user);

    expect(
      within(groupNamed("Active")).getByRole("option", {
        name: "Host Name: Human, favorite",
      }),
    ).toBeInTheDocument();
    expect(
      within(groupNamed("Favorites")).getByRole("option", {
        name: "Genome Status, favorite",
      }),
    ).toBeInTheDocument();
    expect(
      within(groupNamed("Other facets"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label"))
    ).toEqual(["Isolation Country", "Species"]);

    expect(valueList("Host Name")).toBeInTheDocument();
  });

  it("lists every facet at once, with no fold to open", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    expect(
      screen.queryByRole("option", { name: /more facets?$/ }),
    ).not.toBeInTheDocument();
    expect(
      within(groupNamed("Favorites"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label"))
    ).toEqual(["Genome Status, favorite", "Host Name, favorite"]);
    expect(
      within(groupNamed("Other facets"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label"))
    ).toEqual(["Isolation Country", "Species"]);
  });

  it("drops the group headings when the favorite facets are all there is", async () => {
    const user = userEvent.setup();
    renderToolbar({ favorites: toolbarFields() });
    await openFilters(user);

    expect(
      within(facetList()).queryByRole("group"),
    ).not.toBeInTheDocument();
    expect(within(facetList()).getAllByRole("option")).toHaveLength(4);
  });

  it("drops the group headings when nothing is a favorite", async () => {
    const user = userEvent.setup();
    renderToolbar({ favorites: [] });
    await openFilters(user);

    expect(
      within(facetList()).queryByRole("group"),
    ).not.toBeInTheDocument();
    expect(within(facetList()).getAllByRole("option")).toHaveLength(4);
    expect(valueList("Genome Status")).toBeInTheDocument();
  });

  it("finds a facet outside the favorites by search", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.type(leftSearch(), "spec");

    expect(screen.getByRole("option", { name: "Species" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Genome Status, favorite" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Species" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(valueList("Species")).toBeInTheDocument();
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
  it("asks for the counts when the menu opens", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: { isolation_country: ["Germany"] },
    });

    await openFilters(user);

    expect(spies.onFacetsWanted).toHaveBeenCalled();
  });

  it("opens any facet's checklist at once, loading until its counts arrive", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.click(screen.getByRole("option", { name: "Species" }));

    expect(valueList("Species")).toBeInTheDocument();
    expect(valueList("Species")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading values…")).toBeInTheDocument();
  });

  it("switches the pane on hover", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    fireEvent.mouseMove(screen.getByRole("option", { name: "Species" }), {
      clientX: 40,
      clientY: 120,
    });

    expect(valueList("Species")).toBeInTheDocument();
  });

  it("ignores a row moving under a still pointer", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    fireEvent.mouseMove(
      screen.getByRole("option", { name: "Genome Status, favorite" }),
      { clientX: 40, clientY: 60 },
    );

    // WebKit reports the row now under the pointer with the same position.
    fireEvent.mouseMove(screen.getByRole("option", { name: "Species" }), {
      clientX: 40,
      clientY: 60,
    });

    expect(valueList("Genome Status")).toBeInTheDocument();
  });
});

describe("FiltersMenu favorites", () => {
  it("moves a facet into Favorites at once when it is starred from its row", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    const row = screen.getByRole("option", { name: "Species" });

    await user.click(within(row).getByTitle("Add to favorites"));

    expect(spies.setFieldFavorite).toHaveBeenCalledWith("species", true);
    expect(
      within(groupNamed("Favorites"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["Genome Status, favorite", "Host Name, favorite", "Species, favorite"]);
    expect(
      within(groupNamed("Other facets"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["Isolation Country"]);
  });

  it("moves a facet back to Other facets at once when it is unstarred", async () => {
    const user = userEvent.setup();
    renderToolbar({ favorites: ["genome_status", "host_name", "species"] });
    await openFilters(user);
    const row = screen.getByRole("option", { name: "Species, favorite" });

    await user.click(
      within(row).getByTitle("Favorite: its counts load up front. Click to remove."),
    );

    expect(
      within(groupNamed("Favorites"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["Genome Status, favorite", "Host Name, favorite"]);
    expect(
      within(groupNamed("Other facets"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("aria-label")),
    ).toEqual(["Isolation Country", "Species"]);
  });

  it("keeps a facet out of Active while the menu is open, so a pick never moves its row", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);

    await user.click(
      within(valueList("Genome Status")).getByRole("option", { name: /^WGS/ }),
    );

    expect(
      within(groupNamed("Favorites")).getByRole("option", {
        name: "Genome Status: WGS, favorite",
      }),
    ).toBeInTheDocument();
    expect(
      within(facetList()).queryByRole("group", { name: "Active" }),
    ).not.toBeInTheDocument();
  });

  it("toggles the shown facet's favorite from the pane header", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar();
    await openFilters(user);
    const favoriteToggle = screen.getByRole("button", { name: "Favorited" });
    expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");

    await user.click(favoriteToggle);

    expect(spies.setFieldFavorite).toHaveBeenLastCalledWith("genome_status", false);
    expect(screen.getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      within(groupNamed("Other facets")).getByRole("option", {
        name: "Genome Status",
      }),
    ).toBeInTheDocument();
    expect(valueList("Genome Status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Favorite" }));

    expect(spies.setFieldFavorite).toHaveBeenLastCalledWith("genome_status", true);
    expect(
      within(groupNamed("Favorites")).getByRole("option", {
        name: "Genome Status, favorite",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Favorited" })).toHaveAttribute(
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

    const host = screen.getByRole("option", { name: "Host Name, favorite" });
    expect(search).toHaveAttribute("aria-activedescendant", host.id);
    expect(valueList("Host Name")).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");

    expect(search).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Genome Status, favorite" }).id,
    );
    expect(valueList("Genome Status")).toBeInTheDocument();
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

    await user.keyboard("{ArrowDown}{Enter}");
    expect(spies.toggleValue).toHaveBeenCalledWith("genome_status", "Complete");

    await user.keyboard("{ArrowLeft}");
    expect(leftSearch()).toHaveFocus();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(
      screen.getByRole("combobox", { name: "Filter Host Name values" }),
    ).toHaveFocus();

    await user.keyboard("{Backspace}");
    expect(leftSearch()).toHaveFocus();
  });

  it("focuses the new checklist when Enter or → opens a facet", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFilters(user);
    await waitFor(() => {
      expect(leftSearch()).toHaveFocus();
    });

    await user.type(leftSearch(), "spec");
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("combobox", { name: "Filter Species values" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    await user.clear(leftSearch());
    await user.type(leftSearch(), "isol");
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
    expect(screen.queryByRole("button", { name: /^Favorite/ })).not.toBeInTheDocument();
  });
});

function toolbarFields() {
  return ["genome_status", "host_name", "isolation_country", "species"];
}
