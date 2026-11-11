import {
  isSearchActionDisabled,
  visibleSearchActions,
  type SearchActionConfig,
} from "@/components/search/search-action-policy";

/**
 * Renders the real `visibleSearchActions`/`isSearchActionDisabled` policy as
 * plain buttons, so the fake cannot offer controls the real bar would not.
 */

/**
 * Keyed by `configKey ?? id`: three ids appear twice in `searchActionConfig`
 * under disjoint search types.
 */
const fakeLabelByConfigKey: Record<string, string> = {
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
