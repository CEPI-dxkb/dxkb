import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { renderToolbar } from "./fixtures/toolbar-harness";

const layout = stubMenuLayout();

const editButton = (name: string) =>
  screen.getByRole("button", { name: `${name}. Edit filter` });

describe("ActiveFilterPill", () => {
  it("shows a filter's first value and how many more", () => {
    renderToolbar({
      filters: { genome_status: ["WGS", "Complete"], host_name: [""] },
    });

    expect(editButton("Genome Status: WGS, Complete")).toHaveTextContent(
      "Genome StatusWGS+1",
    );
    expect(editButton("Host Name: (empty)")).toHaveTextContent(
      "Host Name(empty)",
    );
    expect(
      screen.getByRole("button", { name: "Filters, 2 active" }),
    ).toBeInTheDocument();
  });

  it("clears its field from the ×", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: { genome_status: ["WGS", "Complete"] },
    });

    await user.click(
      screen.getByRole("button", { name: "Clear Genome Status filter" }),
    );

    expect(spies.setFieldValues).toHaveBeenCalledWith("genome_status", []);
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the facet's checklist and counts a facet outside the set", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: { isolation_country: ["Germany"] },
    });

    await user.click(editButton("Isolation Country: Germany"));

    const list = await screen.findByRole("listbox", {
      name: "Isolation Country values",
    });
    expect(spies.onFacetsWanted).toHaveBeenCalled();
    expect(spies.setPeekedFields).toHaveBeenCalledWith(
      new Set(["isolation_country"]),
    );
    expect(
      within(list).getByRole("option", { selected: true }),
    ).toHaveTextContent("Germany7");

    await user.click(within(list).getByRole("option", { name: /^France/ }));

    expect(spies.toggleValue).toHaveBeenCalledWith(
      "isolation_country",
      "France",
    );
    expect(
      within(list).getAllByRole("option", { selected: true }),
    ).toHaveLength(2);
  });

  it("stays on the row while open after its last value is unticked", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { genome_status: ["WGS"] } });

    await user.click(editButton("Genome Status: WGS"));
    const list = await screen.findByRole("listbox", {
      name: "Genome Status values",
    });
    await user.click(within(list).getByRole("option", { name: /^WGS/ }));

    // A dashed pill holds the popover's anchor; the checklist stays open.
    const held = screen.getByRole("button", { name: "Filter by Genome Status" });
    expect(held).toHaveAttribute("aria-expanded", "true");
    expect(list).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filters" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Filter by Genome Status" }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps a link filter's pill open after its last value is unticked", async () => {
    const user = userEvent.setup();
    renderToolbar({ filters: { strain: ["K-12"] } });

    await user.click(editButton("strain: K-12"));
    const list = await screen.findByRole("listbox", { name: "strain values" });
    await user.click(within(list).getByRole("option", { name: /^K-12/ }));

    // No facet names the field, yet its pill still anchors the checklist.
    expect(
      screen.getByRole("button", { name: "Filter by strain" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(list).toBeInTheDocument();
    // Nothing counts the field, so the list cannot say no record has it.
    expect(within(list).getByText("No values picked")).toBeInTheDocument();
    expect(
      within(list).getByText("Without a facet, only picked values are listed."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("None of the matching records has this field set."),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Filter by strain" }),
      ).not.toBeInTheDocument();
    });
  });

  it("puts pills that do not fit behind +N, which opens the Filters menu on the first", async () => {
    layout.setClientWidth(0);
    const user = userEvent.setup();
    renderToolbar({
      filters: { genome_status: ["WGS"], isolation_country: ["Germany"] },
    });

    const more = await screen.findByRole("button", {
      name: "2 more filters: Genome Status, Isolation Country. Open in the Filters menu",
    });
    expect(more).toHaveTextContent("+2");
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();

    await user.click(more);

    const search = await screen.findByRole("combobox", {
      name: "Filter Genome Status values",
    });
    await waitFor(() => {
      expect(search).toHaveFocus();
    });
    expect(
      screen.getByRole("listbox", { name: "Facets" }),
    ).toBeInTheDocument();
  });

  it("all go with Clear all, which then hides itself", async () => {
    const user = userEvent.setup();
    const { spies } = renderToolbar({
      filters: { genome_status: ["WGS"], strain: ["K-12"] },
    });

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(spies.clearAll).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });
});
