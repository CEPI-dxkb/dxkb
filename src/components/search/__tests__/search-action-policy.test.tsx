import { cleanup, render, screen } from "@testing-library/react";

import { createSearchActionBarFake } from "@/components/views/__tests__/fixtures/search-action-bar-fake";
import { SearchActionBar } from "../search-action-bar";
import {
  isSearchActionDisabled,
  notReady,
  searchActionConfig,
  visibleSearchActions,
  type SearchActionConfig,
} from "../search-action-policy";

/**
 * The visibility and enablement rules `SearchActionBar` and the
 * `resource-collection*.test.tsx` fake both read, plus the parity that matters: the
 * fake must offer exactly the actions production would, in the same order and with
 * the same disabled states. The fake used to restate a subset of these rules by hand
 * and drifted, which let those suites click 23 controls the real bar never renders.
 */

const searchTypes = [
  ...new Set(
    searchActionConfig.flatMap((action) =>
      action.validSearchTypes === "*" ? [] : action.validSearchTypes,
    ),
  ),
];

function byId(id: SearchActionConfig["id"]) {
  return (action: SearchActionConfig) => action.id === id;
}

describe("visibleSearchActions", () => {
  it("drops actions outside the search type", () => {
    const visible = visibleSearchActions({
      searchType: "taxonomy",
      selectedCount: 1,
      hasGuideUrl: false,
    });

    expect(visible.map((action) => action.id)).toStrictEqual([
      "taxonOverview",
      "services",
      "genomes",
      "features",
    ]);
  });

  it("keeps wildcard actions for every search type", () => {
    for (const searchType of searchTypes) {
      const visible = visibleSearchActions({
        searchType,
        selectedCount: 1,
        hasGuideUrl: true,
      });
      expect(visible.filter(byId("guide"))).toHaveLength(1);
      expect(visible.filter(byId("services"))).toHaveLength(1);
    }
  });

  it("drops GUIDE rather than disabling it when there is nowhere to go", () => {
    const visible = visibleSearchActions({
      searchType: "taxonomy",
      selectedCount: 0,
      hasGuideUrl: false,
    });

    expect(visible).toStrictEqual([]);
  });

  it("drops selection-dependent actions until a row is selected", () => {
    const visible = visibleSearchActions({
      searchType: "genome_feature",
      selectedCount: 0,
      hasGuideUrl: true,
    });

    expect(visible.map((action) => action.id)).toStrictEqual(["guide"]);
    expect(visible.filter(byId("download"))).toHaveLength(0);
  });

  it("drops single-select-only actions once the selection grows", () => {
    const single = visibleSearchActions({
      searchType: "genome_feature",
      selectedCount: 1,
      hasGuideUrl: false,
    });
    const multiple = visibleSearchActions({
      searchType: "genome_feature",
      selectedCount: 2,
      hasGuideUrl: false,
    });

    // FEATURE and GENOME are maxSelection:1; DWNLD and GROUP have no upper bound.
    expect(single.filter(byId("feature"))).toHaveLength(1);
    expect(single.filter(byId("genome"))).toHaveLength(1);
    expect(multiple.filter(byId("feature"))).toHaveLength(0);
    expect(multiple.filter(byId("genome"))).toHaveLength(0);
    expect(multiple.filter(byId("download"))).toHaveLength(1);
    expect(multiple.filter(byId("group"))).toHaveLength(1);
  });

  it("never offers DWNLD to the resources that download from the table instead", () => {
    // Taxa, Strains and Genomes are absent from `download`'s validSearchTypes, so
    // their action bar has no DWNLD entry at any selection size.
    for (const searchType of ["taxonomy", "strain", "genome"]) {
      for (const selectedCount of [0, 1, 2, 7]) {
        expect(
          visibleSearchActions({
            searchType,
            selectedCount,
            hasGuideUrl: true,
          }).filter(byId("download")),
        ).toHaveLength(0);
      }
    }
  });
});

describe("isSearchActionDisabled", () => {
  const services = searchActionConfig.find(byId("services"));
  const genome = searchActionConfig.find(byId("genome"));

  it("disables an action the consumer gave a reason for", () => {
    expect(
      isSearchActionDisabled(services as SearchActionConfig, {
        disabledActions: { services: "No genomes are associated with this" },
      }),
    ).toBe(true);
  });

  it("disables a disabledWithTooltip action the consumer did not opt in", () => {
    expect(isSearchActionDisabled(services as SearchActionConfig, {})).toBe(
      true,
    );
    expect(
      isSearchActionDisabled(services as SearchActionConfig, {
        enabledActions: ["services"],
      }),
    ).toBe(false);
    expect(services).toEqual(
      expect.objectContaining({ disabledWithTooltip: notReady }),
    );
  });

  it("leaves an action with no disabledWithTooltip enabled without opting in", () => {
    expect(isSearchActionDisabled(genome as SearchActionConfig, {})).toBe(
      false,
    );
    expect(genome?.disabledWithTooltip).toBeUndefined();
  });
});

describe("SearchActionBar / test-fake parity", () => {
  const SearchActionBarFake = createSearchActionBarFake(() => undefined);
  const enabledActions = searchActionConfig.map((action) => action.id);

  function buttonStates() {
    return screen
      .getAllByRole("button", { hidden: true })
      .map((button) => button.hasAttribute("disabled"));
  }

  // Every search type the config mentions, at the selection sizes the policy
  // distinguishes, with and without the two consumer-side overrides.
  const cases = searchTypes.flatMap((searchType) =>
    [0, 1, 2].flatMap((selectedCount) =>
      [
        { name: "defaults", props: {} },
        { name: "all actions opted in", props: { enabledActions } },
        {
          name: "a consumer reason",
          props: { disabledActions: { services: "Not here" } },
        },
      ].map(({ name, props }) => ({
        searchType,
        selectedCount,
        name,
        props,
      })),
    ),
  );

  it.each(cases)(
    "offers the same $searchType actions at $selectedCount selected with $name",
    ({ searchType, selectedCount, props }) => {
      const shared = {
        searchType,
        selectedCount,
        guideUrl: "https://example.test/guide",
        ...props,
      };
      const expected = visibleSearchActions({
        searchType,
        selectedCount,
        hasGuideUrl: true,
      });

      render(<SearchActionBar {...shared} />);
      const realStates = buttonStates();
      const realNames = screen
        .getAllByRole("button", { hidden: true })
        .map((button) => button.textContent);
      cleanup();

      render(<SearchActionBarFake {...shared} />);
      const fakeStates = buttonStates();

      expect(realStates).toHaveLength(expected.length);
      expect(fakeStates).toStrictEqual(realStates);
      // Order too, so the fake cannot rearrange the bar under a suite's feet.
      // The real bar prints the letter glyph (where an entry has one) ahead of the
      // label, and splits a two-line label into adjacent spans with no separator.
      expect(realNames).toStrictEqual(
        expected.map(
          (action) =>
            `${action.letter ?? ""}${action.label.replaceAll("\n", "")}`,
        ),
      );
    },
  );
});
