import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";

import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { jsdomLocalStorage } from "@/test-helpers/storage";

import { GraphFilterBar } from "../graph-filter-bar";

stubMenuLayout();

type GraphFilterBarProps = ComponentProps<typeof GraphFilterBar>;

function barProps(
  overrides: Partial<GraphFilterBarProps> = {},
): GraphFilterBarProps {
  return {
    filters: {},
    facets: {
      interaction_type: [
        { value: "association", count: 12 },
        { value: "physical association", count: 3 },
      ],
    },
    facetStatuses: {
      category: "ready",
      interaction_type: "ready",
      detection_method: "ready",
    },
    onFacetsWanted: vi.fn(),
    onPrefetchFacets: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
}

async function pickInteractionType(
  user: ReturnType<typeof userEvent.setup>,
  value: string,
) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  await user.click(
    within(
      await screen.findByRole("listbox", { name: "Filters" }),
    ).getByRole("option", { name: /^Interaction Type/ }),
  );
  await user.click(
    within(
      screen.getByRole("listbox", { name: "Interaction Type values" }),
    ).getByRole("option", { name: new RegExp(`^${value}`) }),
  );
}

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

describe("GraphFilterBar", () => {
  it("offers the interaction keyword box and Filters, without a Columns menu", () => {
    render(<GraphFilterBar {...barProps()} />);

    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Columns/ }),
    ).not.toBeInTheDocument();
  });

  it("commits one uncommitted keyword draft when unmounted before the debounce", () => {
    // The Graph unmounts on a switch to the Table tab; text typed just before it must not be lost.
    const onChange = vi.fn<GraphFilterBarProps["onChange"]>();
    const { unmount } = render(<GraphFilterBar {...barProps({ onChange })} />);

    fireEvent.change(
      screen.getByPlaceholderText("Search interaction results..."),
      { target: { value: "half-typed" } },
    );
    unmount();

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "half-typed", filters: {} }),
    );
  });

  it("lists the interaction facets", async () => {
    const user = userEvent.setup();
    render(<GraphFilterBar {...barProps()} />);

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    const menu = await screen.findByRole("listbox", { name: "Filters" });

    expect(
      within(menu)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Category", "Interaction Type", "Detection Method"]);
  });

  it("reports a pick with the filters it makes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<GraphFilterBarProps["onChange"]>();
    render(<GraphFilterBar {...barProps({ keyword: "groEL", onChange })} />);

    await pickInteractionType(user, "association");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "groEL",
        filters: { interaction_type: ["association"] },
      }),
    );
  });

  it("clears the keyword and every filter with Clear all", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<GraphFilterBarProps["onChange"]>();
    function Owner() {
      const [filters, setFilters] = useState<GraphFilterBarProps["filters"]>({
        interaction_type: ["association"],
      });
      const [keyword, setKeyword] = useState<string | undefined>("groEL");
      return (
        <GraphFilterBar
          {...barProps({
            keyword,
            filters,
            onChange: (update) => {
              onChange(update);
              setKeyword(update.keyword);
              setFilters(update.filters);
            },
          })}
        />
      );
    }
    render(<Owner />);

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: undefined, filters: {} }),
    );
    expect(
      screen.getByPlaceholderText("Search interaction results..."),
    ).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /Edit filter$/ }),
    ).not.toBeInTheDocument();
  });

  it("shares favorite facets with the Interactions Table", async () => {
    const user = userEvent.setup();
    render(<GraphFilterBar {...barProps()} />);

    await user.click(screen.getByRole("button", { name: /^Filters/ }));
    await user.click(
      within(
        await screen.findByRole("listbox", { name: "Filters" }),
      ).getByRole("option", { name: "Detection Method" }),
    );
    await user.click(screen.getByRole("button", { name: "Favorite" }));

    expect(
      JSON.parse(
        localStorage.getItem("dxkb-table-layout:v1:collection:ppi") ?? "null",
      ),
    ).toStrictEqual({ facets: { detection_method: true } });
  });

  it("shows the focused protein as a Protein pill and drops it from the pill's ×", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<GraphFilterBarProps["onChange"]>();
    render(
      <GraphFilterBar
        {...barProps({
          filters: {
            interactor: ["fig|224914.16.peg.635"],
            interaction_type: ["association"],
          },
          onChange,
        })}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Protein: fig|224914.16.peg.635. Edit filter",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear Protein filter" }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { interaction_type: ["association"] },
      }),
    );
  });
});
