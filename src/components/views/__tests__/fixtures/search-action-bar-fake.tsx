/**
 * A `SearchActionBar` fake shared by every `resource-collection*.test.tsx` suite (plan
 * item 21). Mirrors the real bar's `isDisabled` (search-action-bar.tsx:377-379,
 * :420-441): an id with a truthy `disabledActions` reason, or a `gatedByEnabledActions`
 * id missing from `enabledActions`, renders as a present, disabled `<button>` — never
 * removed from the DOM. Only `validSearchTypes`/`requiresSelection`/`maxSelection`
 * control whether the real bar renders a button at all, and this fake does not model
 * those (every consumer of it needs the full fixed action list present regardless of
 * `searchType` or selection count); it only needs to be faithful about *disabled*.
 *
 * Kept as one shared implementation rather than copied per file (as it briefly was):
 * `gatedByEnabledActions` is a real behavioral contract mirroring the real
 * `actionConfig`'s `disabledWithTooltip` entries, and a hand-copied Set drifting out of
 * sync with a production change would silently reintroduce the exact "impossible
 * interaction" this item exists to close, with nothing to catch it.
 */

/**
 * The `SearchActionId`s the real bar's `actionConfig` marks `disabledWithTooltip`, and
 * therefore actually disables via `enabledActions`. Every other id below is a
 * member-navigation or DWNLD action the real bar never disables through
 * `enabledActions` — only an explicit `disabledActions` reason can turn it off. Keep
 * this in sync with `actionConfig`: a resource that starts including a newly
 * `disabledWithTooltip` id in `enabledActions` (or drops one) needs the same change
 * here.
 */
const gatedByEnabledActions = new Set([
  "genomes",
  "features",
  "services",
  "biosets",
  "ppiFeatures",
]);

/**
 * The one action-bar button per id this fixture renders, labeled to match what the
 * `resource-collection*.test.tsx` suites click and query by. Some ids repeat under a
 * different label (`features`/`ppiFeatures`) because different suites exercise the
 * same dispatch id through the label a different resource's tab uses for it.
 */
const searchActionBarFakeActions = [
  { id: "genome", label: "Genome action" },
  { id: "genomes", label: "Genomes action" },
  { id: "feature", label: "Feature action" },
  { id: "features", label: "Features action" },
  { id: "surveillance", label: "Surveillance action" },
  { id: "experiment", label: "Experiment action" },
  { id: "taxonOverview", label: "taxonOverview" },
  { id: "features", label: "features" },
  { id: "services", label: "services" },
  { id: "download", label: "Download action" },
  { id: "structure", label: "Structure action" },
  { id: "biosets", label: "Biosets action" },
  { id: "epitope", label: "Epitope action" },
  { id: "ppiFeatures", label: "Interaction features action" },
] as const;

/**
 * Builds the `SearchActionBar` mock component. `onRender` receives the raw props on
 * every render, so a consuming test file can capture them into its own
 * `actionBarProps` for the `toMatchObject`/`toStrictEqual` assertions the cross-resource
 * matrix and the individual resource tests already make.
 */
export function createSearchActionBarFake(
  onRender: (props: Record<string, unknown>) => void,
) {
  return function SearchActionBarFake(props: Record<string, unknown>) {
    onRender(props);
    const enabledActions = props.enabledActions as string[] | undefined;
    const disabledActions = props.disabledActions as
      | Record<string, string | undefined>
      | undefined;
    const onAction = props.onAction as ((action: string) => void) | undefined;
    const isDisabled = (id: string) =>
      Boolean(disabledActions?.[id]) ||
      (gatedByEnabledActions.has(id) && !enabledActions?.includes(id));
    return (
      <div>
        {searchActionBarFakeActions.map(({ id, label }) => (
          <button
            key={label}
            disabled={isDisabled(id)}
            onClick={() => onAction?.(id)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  };
}
