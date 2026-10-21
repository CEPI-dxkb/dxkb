import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { ResourceFilterBar } from "../resource-filter-bar";

stubMenuLayout();

type FilterBarProps = ComponentProps<typeof ResourceFilterBar>;

const facets = {
  genome_status: [
    { value: "Complete", count: 10 },
    { value: "WGS", count: 20 },
  ],
};
const definitions = [
  { field: "genome_status", label: "Genome Status", initiallyVisible: true },
];

const layoutKey = "collection:genome";
const layoutStorageKey = "dxkb-table-layout:v1:collection:genome";
// `a` is pinned by default and `b` starts in More.
const pickableDefinitions = [
  { field: "a", label: "Facet A" },
  { field: "b", label: "Facet B", initiallyVisible: false },
];

function filterBarProps(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    layoutKey,
    filters: {},
    facets,
    facetStatuses: { genome_status: "ready" },
    peekedFields: new Set(),
    onPeekedFieldsChange: vi.fn(),
    onFacetsWanted: vi.fn(),
    onPrefetchFacets: vi.fn(),
    definitions,
    onChange: vi.fn(),
    columns: [],
    setColumns: vi.fn(),
    resetColumns: vi.fn(),
    ...overrides,
  };
}

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("listbox", { name: "Facets" });
}

const statusValues = () =>
  screen.getByRole("listbox", { name: "Genome Status values" });
const statusOption = (value: string) =>
  within(statusValues()).getByRole("option", { name: new RegExp(`^${value}`) });

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResourceFilterBar keyword", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces keyword commits", () => {
    const onChange = vi.fn();
    render(<ResourceFilterBar {...filterBarProps({ onChange })} />);

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

  it("keeps typing that follows a trimmed keyword commit", () => {
    const onChange = vi.fn();
    const props = filterBarProps({ onChange });
    const { rerender } = render(<ResourceFilterBar {...props} />);
    const searchbox = screen.getByRole("searchbox");

    fireEvent.change(searchbox, { target: { value: "eco " } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenLastCalledWith({ keyword: "eco", filters: {} });

    // The user types on before the trimmed keyword reaches the URL.
    fireEvent.change(searchbox, { target: { value: "eco k" } });
    rerender(<ResourceFilterBar {...props} keyword="eco" />);
    expect(searchbox).toHaveValue("eco k");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({
      keyword: "eco k",
      filters: {},
    });
  });

  it("keeps a trailing space once the trimmed keyword lands", () => {
    const onChange = vi.fn();
    const props = filterBarProps({ onChange });
    const { rerender } = render(<ResourceFilterBar {...props} />);
    const searchbox = screen.getByRole("searchbox");

    fireEvent.change(searchbox, { target: { value: "eco " } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<ResourceFilterBar {...props} keyword="eco" />);
    expect(searchbox).toHaveValue("eco ");

    // The URL already holds the trimmed draft, so nothing is written again.
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("ResourceFilterBar picks", () => {
  it("shows a pick at once, before the page's filters catch up", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = filterBarProps({ onChange });
    const { rerender } = render(<ResourceFilterBar {...props} />);
    await openFilters(user);
    vi.useFakeTimers();

    fireEvent.click(statusOption("WGS"));

    expect(onChange).toHaveBeenCalledWith({
      keyword: undefined,
      filters: { genome_status: ["WGS"] },
      clearRql: false,
    });
    expect(statusOption("WGS")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: "Genome Status: WGS. Edit filter" }),
    ).toBeInTheDocument();

    // The page's filters arrive; nothing reverts after the grace period.
    rerender(
      <ResourceFilterBar {...props} filters={{ genome_status: ["WGS"] }} />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(statusOption("WGS")).toHaveAttribute("aria-selected", "true");
  });

  it("commits a keyword with a pick made while it was pending", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ResourceFilterBar {...filterBarProps({ onChange })} />);
    await openFilters(user);
    vi.useFakeTimers();

    fireEvent.change(screen.getByRole("searchbox", { hidden: true }), {
      target: { value: "influenza" },
    });
    fireEvent.click(statusOption("WGS"));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The page's filters have not caught up, so the keyword carries the pick.
    expect(onChange).toHaveBeenLastCalledWith({
      keyword: "influenza",
      filters: { genome_status: ["WGS"] },
      clearRql: false,
    });
  });

  it("keeps a pending pick's rql replacement when the keyword commits", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({ hasExplicitRql: true, onChange })}
      />,
    );
    await openFilters(user);
    vi.useFakeTimers();

    fireEvent.change(screen.getByRole("searchbox", { hidden: true }), {
      target: { value: "influenza" },
    });
    fireEvent.click(statusOption("WGS"));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onChange).toHaveBeenLastCalledWith({
      keyword: "influenza",
      filters: { genome_status: ["WGS"] },
      clearRql: true,
    });
  });

  it("keeps a pending pick's rql replacement through a pick kept beside the rql", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: { ...facets, host: [{ value: "Human", count: 5 }] },
          facetStatuses: { genome_status: "ready", host: "ready" },
          definitions: [
            ...definitions,
            { field: "host", label: "Host", initiallyVisible: true },
          ],
          hasExplicitRql: true,
          filtersBesideRql: ["host"],
          onChange,
        })}
      />,
    );
    await openFilters(user);

    await user.click(statusOption("WGS"));
    await user.click(screen.getByRole("option", { name: /^Host/ }));
    await user.click(
      within(
        screen.getByRole("listbox", { name: "Host values" }),
      ).getByRole("option", { name: /^Human/ }),
    );

    // The first pick replaced the rql; the page has not caught up, so the
    // second must not bring the rql back over it.
    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: { genome_status: ["WGS"], host: ["Human"] },
      clearRql: true,
    });
  });

  it("reverts a pick the page drops", async () => {
    const user = userEvent.setup();
    render(<ResourceFilterBar {...filterBarProps()} />);
    await openFilters(user);
    vi.useFakeTimers();

    fireEvent.click(statusOption("WGS"));
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(statusOption("WGS")).toHaveAttribute("aria-selected", "true");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(statusOption("WGS")).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("button", { name: "Filters" }),
    ).toBeInTheDocument();
  });

  it("picks two values in one facet with the menu staying open", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<FilterBarProps["onChange"]>();
    // The page writes each pick back, as the URL would.
    function Page() {
      const [filters, setFilters] = useState<FilterBarProps["filters"]>({});
      return (
        <ResourceFilterBar
          {...filterBarProps({
            filters,
            onChange: (update) => {
              onChange(update);
              setFilters(update.filters);
            },
          })}
        />
      );
    }
    render(<Page />);
    await openFilters(user);

    await user.click(statusOption("Complete"));
    await user.click(statusOption("WGS"));

    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: { genome_status: ["Complete", "WGS"] },
      clearRql: false,
    });
    expect(
      within(statusValues()).getAllByRole("option", { selected: true }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", {
        name: "Genome Status: Complete, WGS. Edit filter",
      }),
    ).toBeInTheDocument();
  });

  it("clears the keyword, every filter and the rql with Clear all", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          keyword: "coli",
          filters: { genome_status: ["WGS"] },
          onChange,
        })}
      />,
    );
    expect(screen.getByRole("searchbox")).toHaveValue("coli");

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenCalledWith({
      keyword: undefined,
      filters: {},
      clearRql: true,
      clearAll: true,
    });
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Clear all when there is nothing to clear", () => {
    render(<ResourceFilterBar {...filterBarProps()} />);

    expect(
      screen.queryByRole("button", { name: "Clear all" }),
    ).not.toBeInTheDocument();
  });
});

describe("ResourceFilterBar beside an explicit rql", () => {
  it("keeps the rql when a picked value belongs to a filter kept beside it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          hasExplicitRql: true,
          filtersBesideRql: ["genome_status"],
          onChange,
        })}
      />,
    );
    await openFilters(user);

    await user.click(statusOption("WGS"));

    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: { genome_status: ["WGS"] },
      clearRql: false,
    });
  });

  it("replaces the rql when a picked value belongs to any other filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({ hasExplicitRql: true, onChange })}
      />,
    );
    await openFilters(user);

    await user.click(statusOption("WGS"));

    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: { genome_status: ["WGS"] },
      clearRql: true,
    });
  });

  it("marks Clear all apart from a pick that replaces the rql", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({ hasExplicitRql: true, onChange })}
      />,
    );
    expect(screen.getByText("Custom query")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenLastCalledWith({
      keyword: undefined,
      filters: {},
      clearRql: true,
      clearAll: true,
    });
  });
});

describe("ResourceFilterBar facet counts", () => {
  it("renders no Filters button when there are no facet definitions", () => {
    render(
      <ResourceFilterBar
        {...filterBarProps({ facets: {}, facetStatuses: {}, definitions: [] })}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /^Filters/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("asks for the counts when Filters is pointed at or focused, and keeps them once opened", async () => {
    const user = userEvent.setup();
    const onPrefetchFacets = vi.fn();
    const onFacetsWanted = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({ onPrefetchFacets, onFacetsWanted })}
      />,
    );
    const filtersButton = screen.getByRole("button", { name: "Filters" });

    fireEvent.pointerEnter(filtersButton);
    fireEvent.focus(filtersButton);
    expect(onPrefetchFacets).toHaveBeenCalledTimes(2);
    expect(onFacetsWanted).not.toHaveBeenCalled();

    await openFilters(user);

    expect(onFacetsWanted).toHaveBeenCalled();
  });

  it("shows placeholder rows, not an empty state, until a facet's first counts land", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        {...filterBarProps({ facets: {}, facetStatuses: {} })}
      />,
    );
    await openFilters(user);

    expect(statusValues()).toHaveAttribute("aria-busy", "true");
    expect(
      statusValues().querySelectorAll('[data-slot="skeleton"]'),
    ).toHaveLength(5);
    expect(
      screen.queryByText("No values in these results"),
    ).not.toBeInTheDocument();
  });

  it("shows why the facet counts could not be loaded, and retries them", async () => {
    const user = userEvent.setup();
    const onRetryFacets = vi.fn();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          facetsError: "Facet query timed out upstream.",
          onRetryFacets,
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load filter values: Facet query timed out upstream.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryFacets).toHaveBeenCalledOnce();

    // The menu repeats the error over the facet's values, with no skeleton.
    await openFilters(user);
    expect(
      within(screen.getByRole("dialog")).getByRole("alert"),
    ).toHaveTextContent("Could not load filter values: Facet query timed out upstream.");
    expect(
      statusValues().querySelector('[data-slot="skeleton"]'),
    ).toBeNull();
  });

  it("keeps the facet error, its Retry disabled as Retrying…, while the retry runs", () => {
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          facetsError: "Facet query timed out upstream.",
          onRetryFacets: vi.fn(),
          facetsRetrying: true,
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load filter values: Facet query timed out upstream.",
    );
    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  });

  it("shows the facet error without a Retry button when no retry is given", () => {
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          facetsError: "Facet query timed out upstream.",
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load filter values: Facet query timed out upstream.",
    );
    expect(
      screen.queryByRole("button", { name: /^Retry/ }),
    ).not.toBeInTheDocument();
  });

  it("shows a quiet note, not a second alert, when the counts failed with the rows", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          facetsUnavailable: true,
          onRetryFacets: vi.fn(),
        })}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await openFilters(user);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("Filter values are unavailable until the results load."),
    ).toBeInTheDocument();
    // Not an empty facet, and not a wait either.
    expect(
      screen.queryByText("No values in these results"),
    ).not.toBeInTheDocument();
    expect(
      statusValues().querySelector('[data-slot="skeleton"]'),
    ).toBeNull();
  });
});

describe("ResourceFilterBar pinned facets", () => {
  it("lists the facets the user pinned on an earlier visit", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ facets: { a: false, b: true } }),
    );
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          definitions: pickableDefinitions,
        })}
      />,
    );
    await openFilters(user);

    expect(
      screen.getByRole("option", { name: "Facet B, pinned" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Show 1 more facet" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^Facet A/ }),
    ).not.toBeInTheDocument();
  });

  it("stores only the difference from the defaults when a facet is pinned", async () => {
    const user = userEvent.setup();
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          definitions: pickableDefinitions,
        })}
      />,
    );
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 1 more facet" }));
    await user.click(screen.getByRole("option", { name: "Facet B" }));

    await user.click(screen.getByRole("button", { name: "Pin" }));

    expect(screen.getByRole("button", { name: "Pinned" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      JSON.parse(localStorage.getItem(layoutStorageKey) ?? "null"),
    ).toStrictEqual({ facets: { b: true } });

    // Back at the defaults, so there is nothing left to remember.
    await user.click(screen.getByRole("button", { name: "Pinned" }));

    expect(screen.getByRole("button", { name: "Pin" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(localStorage.getItem(layoutStorageKey)).toBeNull();
  });

  it("keeps the column layout stored under the same key when a facet is pinned", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({ visibility: { genome_id: false }, widths: { name: 180 } }),
    );
    render(
      <ResourceFilterBar
        {...filterBarProps({
          facets: {},
          facetStatuses: {},
          definitions: pickableDefinitions,
        })}
      />,
    );
    await openFilters(user);
    await user.click(screen.getByRole("option", { name: "Show 1 more facet" }));
    await user.click(screen.getByRole("option", { name: "Facet B" }));

    await user.click(screen.getByRole("button", { name: "Pin" }));

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(layoutStorageKey) ?? "null"),
      ).toStrictEqual({
        visibility: { genome_id: false },
        widths: { name: 180 },
        facets: { b: true },
      });
    });
  });
});
