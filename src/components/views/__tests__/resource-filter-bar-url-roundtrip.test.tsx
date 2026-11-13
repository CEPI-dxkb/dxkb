import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { genomeCollectionOptions, genomeCollectionProfile } from "@/lib/genome-view";
import {
  parseCollectionState,
  replaceCollectionSearchParams,
  toSearchParamsRecord,
} from "@/lib/views/collection-state";
import { stubMenuLayout } from "@/test-helpers/menu-layout";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { ResourceFilterBar } from "../resource-filter-bar";

stubMenuLayout();

/**
 * The panel against the real Genome URL state: a pick is serialized into a
 * search string and parsed back, as `useCollectionUrlState` does, so a filter
 * the URL drops cannot hide behind an `onChange` mock (DXKBCORE-344).
 */

const genomeFacets = genomeCollectionProfile.facets ?? [];

/** A value the URL state accepts for the field (`public` takes only booleans). */
function pickableValue(field: string): string {
  return genomeCollectionOptions.filterValues?.[field]?.[0] ?? `${field} value`;
}

const facetCounts = Object.fromEntries(
  genomeFacets.map(({ field }) => [
    field,
    [{ value: pickableValue(field), count: 10 }],
  ]),
);
const facetStatuses = Object.fromEntries(
  genomeFacets.map(({ field }) => [field, "ready" as const]),
);

function parseAddress(search: string) {
  return parseCollectionState(
    toSearchParamsRecord(new URLSearchParams(search)),
    genomeCollectionOptions,
  );
}

/** Keeps its filters in a search string, shown in an "Address" readout. */
function Page({
  facets = facetCounts,
}: {
  facets?: Record<string, { value: string; count: number }[]>;
}) {
  const [search, setSearch] = useState("");
  const state = parseAddress(search);
  return (
    <>
      <ResourceFilterBar
        layoutKey="collection:genome"
        filters={state.filters}
        facets={facets}
        facetStatuses={facetStatuses}
        onFacetsWanted={() => undefined}
        onPrefetchFacets={() => undefined}
        definitions={genomeFacets}
        columns={[]}
        setColumns={() => undefined}
        resetColumns={() => undefined}
        onChange={({ filters }) => {
          setSearch(
            replaceCollectionSearchParams(
              toSearchParamsRecord(new URLSearchParams(search)),
              { ...state, filters, page: 1 },
              genomeCollectionOptions,
            ).toString(),
          );
        }}
      />
      <output aria-label="Address">{search}</output>
    </>
  );
}

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const addressFilters = () =>
  parseAddress(screen.getByRole("status", { name: "Address" }).textContent)
    .filters;

const facetOption = (label: string) =>
  within(screen.getByRole("listbox", { name: "Filters" })).queryByRole(
    "option",
    { name: new RegExp(`^${escapeRegExp(label)}(?::|,|$)`) },
  );

const valueOption = (label: string, value: string) =>
  within(screen.getByRole("listbox", { name: `${label} values` })).getByRole(
    "option",
    { name: new RegExp(`^${escapeRegExp(value)}`) },
  );

async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("listbox", { name: "Filters" });
}

/** Opens a facet's values from the list of every filter. */
function openFacet(label: string) {
  const option = facetOption(label);
  expect(option).not.toBeNull();
  if (option) fireEvent.click(option);
}

function pick(label: string, value: string) {
  openFacet(label);
  fireEvent.click(valueOption(label, value));
}

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ResourceFilterBar through the Genome URL state", () => {
  it("offers every facet DXKBCORE-344 reported", () => {
    expect(genomeFacets.map(({ field }) => field)).toEqual(
      expect.arrayContaining([
        "segment",
        "subtype",
        "h_type",
        "n_type",
        "isolation_country",
        "state_province",
        "geographic_group",
      ]),
    );
  });

  it.each(genomeFacets.map(({ field, label }) => [label, field, pickableValue(field)]))(
    "keeps a pick on %s and writes it to the URL",
    async (label, field, value) => {
      const user = userEvent.setup();
      render(<Page />);
      await openFilters(user);
      vi.useFakeTimers();

      pick(label, value);
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(valueOption(label, value)).toHaveAttribute("aria-selected", "true");
      // The overlay alone could keep the option selected; the URL must hold it.
      expect(addressFilters()[field]).toEqual([value]);
    },
  );

  it.each([
    ["Isolation Country first", ["Isolation Country", "State/Province"]],
    ["State/Province first", ["State/Province", "Isolation Country"]],
  ])("keeps USA and Texas, %s", async (_order, labels) => {
    const user = userEvent.setup();
    const values: Record<string, string> = {
      "Isolation Country": "USA",
      "State/Province": "Texas",
    };
    render(
      <Page
        facets={{
          ...facetCounts,
          isolation_country: [{ value: "USA", count: 10 }],
          state_province: [{ value: "Texas", count: 3 }],
        }}
      />,
    );
    await openFilters(user);
    vi.useFakeTimers();

    for (const label of labels) {
      pick(label, values[label]);
      act(() => {
        vi.advanceTimersByTime(10);
      });
    }
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    for (const label of labels) {
      openFacet(label);
      expect(valueOption(label, values[label])).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
    expect(addressFilters()).toEqual(
      expect.objectContaining({
        isolation_country: ["USA"],
        state_province: ["Texas"],
      }),
    );
  });
});
