import { isUsaTopoName, lookupCountryCount } from "./color-scale";
import { featureName, type CountryFeature } from "./topology-utils";

/**
 * The names the "Zoom to country" Select lists: topology countries that have a count, which
 * is what the map paints. Built from the features, not the data keys, so every option has a
 * country to zoom to. The USA is left out: it opens the US view (see WorldCountriesLayer).
 */
export function countryZoomOptions(
  features: readonly CountryFeature[],
  countryData: Record<string, number>,
): string[] {
  const names: string[] = [];
  for (const feature of features) {
    const name = featureName(feature.properties);
    if (!name || isUsaTopoName(name)) continue;
    if (lookupCountryCount(name, countryData) > 0) names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}
