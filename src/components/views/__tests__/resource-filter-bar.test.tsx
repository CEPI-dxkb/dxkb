import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceFilterBar } from "../resource-filter-bar";

const facets = {
  genome_status: [
    { value: "Complete", count: 10 },
    { value: "WGS", count: 20 },
  ],
};
const definitions = [
  { field: "genome_status", label: "Genome Status", initiallyVisible: true },
];

const multiFacets = {
  genome_status: [
    { value: "Complete", count: 10 },
    { value: "WGS", count: 20 },
  ],
  host_name: [{ value: "Human", count: 5 }],
};
const multiDefinitions = [
  { field: "genome_status", label: "Genome Status", initiallyVisible: true },
  { field: "host_name", label: "Host Name", initiallyVisible: true },
];

describe("ResourceFilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces keyword commits", () => {
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={facets}
        definitions={definitions}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "influenza" },
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledWith({
      keyword: "influenza",
      filters: {},
    });
  });

  it("adds multiple facet values and removes selected chips", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ResourceFilterBar
        filters={{ genome_status: ["Complete"] }}
        facets={facets}
        definitions={definitions}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "WGS (20)" }));
    expect(onChange).toHaveBeenCalledWith({
      keyword: undefined,
      filters: { genome_status: ["Complete", "WGS"] },
      clearRql: false,
    });

    rerender(
      <ResourceFilterBar
        filters={{ genome_status: ["Complete", "WGS"] }}
        facets={facets}
        definitions={definitions}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove genome_status: Complete filter",
      }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: { genome_status: ["WGS"] },
    });
  });
});

describe("ResourceFilterBar facet controls", () => {
  it("renders no facet controls when there are no facet definitions", () => {
    render(
      <ResourceFilterBar
        filters={{}}
        facets={{}}
        definitions={[]}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Show Filters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Hide Filters" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Facets" }),
    ).not.toBeInTheDocument();
  });

  it("opens the facet chooser via keyboard and exposes aria-expanded", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={facets}
        definitions={definitions}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Filters" }));
    const trigger = screen.getByRole("button", { name: "Facets" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Genome Status" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={facets}
        definitions={definitions}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Filters" }));
    const trigger = screen.getByRole("button", { name: "Facets" });
    await user.click(trigger);
    // Base UI opens on the next animation frame after a pointer click, so
    // poll for the menu item rather than asserting synchronously.
    await screen.findByRole("menuitemcheckbox", { name: "Genome Status" });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Genome Status" }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("closes when clicking outside the menu", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={facets}
        definitions={definitions}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Filters" }));
    await user.click(screen.getByRole("button", { name: "Facets" }));
    await screen.findByRole("menuitemcheckbox", { name: "Genome Status" });

    await user.click(document.body);

    await waitFor(() => {
      expect(
        screen.queryByRole("menuitemcheckbox", { name: "Genome Status" }),
      ).not.toBeInTheDocument();
    });
  });

  it("supports selecting multiple facets in one open session without closing the menu", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={multiFacets}
        definitions={multiDefinitions}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Filters" }));
    await user.click(screen.getByRole("button", { name: "Facets" }));

    const genomeItem = await screen.findByRole("menuitemcheckbox", {
      name: "Genome Status",
    });
    const hostItem = screen.getByRole("menuitemcheckbox", {
      name: "Host Name",
    });
    expect(genomeItem).toHaveAttribute("aria-checked", "true");
    expect(hostItem).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", { name: "WGS (20)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Human (5)" }),
    ).toBeInTheDocument();

    await user.click(genomeItem);

    // Menu must stay open so a second selection can be made in the same session.
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Genome Status" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Host Name" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "WGS (20)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Human (5)" }),
    ).toBeInTheDocument();

    await user.click(hostItem);

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Host Name" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.queryByRole("button", { name: "Human (5)" }),
    ).not.toBeInTheDocument();
  });

  it("uses theme tokens instead of hardcoded gray utility classes", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        filters={{}}
        facets={facets}
        definitions={definitions}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show Filters" }));

    const facetsButton = screen.getByRole("button", { name: "Facets" });
    const hideButton = screen.getByRole("button", { name: "Hide Filters" });
    const panel = screen.getByText("Genome Status").closest(".overflow-auto");

    expect(facetsButton.className).not.toMatch(/gray-/);
    expect(hideButton.className).not.toMatch(/gray-/);
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/gray-/);

    // The panel renders FacetColumn for each visible facet — guard its markup
    // too, so a hardcoded `text-white` (illegible once the panel follows the
    // light/dark background token) can't creep back in unnoticed.
    expect(panel?.innerHTML).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/text-white/);
  });
});
