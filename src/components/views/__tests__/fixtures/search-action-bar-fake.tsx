import {
  isSearchActionDisabled,
  visibleSearchActions,
  type SearchActionConfig,
} from "@/components/search/search-action-policy";

/**
 * A `SearchActionBar` fake shared by every `resource-collection*.test.tsx` suite.
 *
 * It renders whatever `visibleSearchActions` says the real bar would render, disabled
 * exactly where `isSearchActionDisabled` says, because it calls those two functions
 * rather than restating them (plan item 33). The previous hand-written version
 * modelled `disabledActions` and the `enabledActions` gate faithfully but did not
 * model `validSearchTypes`, `requiresSelection` or `maxSelection`, so it offered a
 * fixed list of buttons regardless of search type or selection size — and the suites
 * clicked, and asserted on, controls the real bar would never have put on screen.
 * Sharing the policy makes that impossible rather than merely discouraged: an
 * `actionConfig` change lands on production and the fake in the same edit.
 *
 * What it still fakes is presentation only: one plain `<button>` per visible action,
 * instead of the real bar's icons, spinners, "not ready" tooltips and sign-in
 * popovers. Every rule that decides whether a button *exists*, or whether it is
 * *disabled* — including the `loadingActionIds` one the bar used to apply on its own
 * — comes from the policy.
 */

/**
 * Labels the `resource-collection*.test.tsx` suites query by, per action-config
 * entry. Keyed by `configKey ?? id` because three ids appear twice in
 * `searchActionConfig` under disjoint `validSearchTypes` (`copyRows`, `features` and
 * `group`), so the id alone does not identify an entry. Anything unmapped falls back
 * to that key, which is a fine accessible name for an action no suite clicks.
 */
const fakeLabelByConfigKey: Record<string, string> = {
  download: "Download action",
  epitope: "Epitope action",
  experiment: "Experiment action",
  biosets: "Biosets action",
  feature: "Feature action",
  "features:genome_sequence": "Features action",
  genome: "Genome action",
  genomes: "Genomes action",
  ppiFeatures: "Interaction features action",
  structure: "Structure action",
  surveillance: "Surveillance action",
};

function fakeLabel(action: SearchActionConfig) {
  const configKey = action.configKey ?? action.id;
  return fakeLabelByConfigKey[configKey] ?? configKey;
}

/**
 * Builds the `SearchActionBar` mock component. `onRender` receives the raw props on
 * every render, so a consuming test file can capture them into its own
 * `actionBarProps` for the `toMatchObject`/`toStrictEqual` assertions the
 * cross-resource matrix and the individual resource tests already make.
 */
export function createSearchActionBarFake(
  onRender: (props: Record<string, unknown>) => void,
) {
  return function SearchActionBarFake(props: Record<string, unknown>) {
    onRender(props);
    const enablement = {
      enabledActions: props.enabledActions as
        SearchActionConfig["id"][] | undefined,
      disabledActions: props.disabledActions as
        Partial<Record<SearchActionConfig["id"], string>> | undefined,
      loadingActionIds: props.loadingActionIds as
        SearchActionConfig["id"][] | undefined,
    };
    const onAction = props.onAction as
      ((action: SearchActionConfig["id"]) => void) | undefined;
    return (
      <div>
        {visibleSearchActions({
          searchType: props.searchType as string,
          selectedCount: props.selectedCount as number,
          hasGuideUrl: Boolean(props.guideUrl),
        }).map((action) => (
          <button
            key={action.configKey ?? action.id}
            disabled={isSearchActionDisabled(action, enablement)}
            onClick={() => {
              onAction?.(action.id);
            }}
          >
            {fakeLabel(action)}
          </button>
        ))}
      </div>
    );
  };
}
