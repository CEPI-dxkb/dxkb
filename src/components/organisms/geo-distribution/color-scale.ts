export type ColorScale = (count: number) => string;

/**
 * The map's seven color steps, fewest genomes first, and the fill of a region
 * with none. `globals.css` defines them per accent (`data-geo-accent`) as an
 * OKLCH ramp with evenly spaced lightness, light to dark, and dark to light
 * on a dark theme, so the steps stay apart in either.
 */
export const geoStepFills = [
  "var(--geo-step-1)",
  "var(--geo-step-2)",
  "var(--geo-step-3)",
  "var(--geo-step-4)",
  "var(--geo-step-5)",
  "var(--geo-step-6)",
  "var(--geo-step-7)",
] as const;
export const geoNoDataFill = "var(--geo-no-data)";

export interface GeoColorStep {
  fill: string;
  /** The fewest genomes a region in this step has. */
  from: number;
}

export interface GeoColorScale {
  fill: ColorScale;
  /** The steps in use, fewest genomes first; none without data. */
  steps: readonly GeoColorStep[];
  /** The most genomes any region has. */
  max: number;
}

/** Two significant figures, so a legend reads 5.2K rather than 5,197. */
function roundBound(value: number): number {
  if (value < 10) return Math.max(1, Math.round(value));
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.round(value / unit) * unit;
}

/** The `p` quantile of ascending `sorted`, interpolated as d3's `quantile`. */
function quantile(sorted: readonly number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const below = Math.floor(index);
  const above = Math.ceil(index);
  return sorted[below] + (sorted[above] - sorted[below]) * (index - below);
}

/**
 * Color steps for the regions a view shows. Each step's lower bound is a
 * quantile of their counts, so the steps hold about as many regions each and
 * the whole ramp is in use however skewed the counts are (one state with 8
 * genomes beside fifty with 5K–115K). A view with fewer distinct bounds than
 * steps spreads its steps across the ramp, so the darkest still marks the
 * most genomes.
 */
export function makeGeoColorScale(counts: Iterable<number>): GeoColorScale {
  const sorted = [...counts]
    .filter((count) => Number.isFinite(count) && count > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { fill: () => geoNoDataFill, steps: [], max: 0 };
  }

  const max = sorted[sorted.length - 1];
  const bounds = [sorted[0]];
  for (let index = 1; index < geoStepFills.length; index += 1) {
    const bound = roundBound(quantile(sorted, index / geoStepFills.length));
    if (bound > bounds[bounds.length - 1] && bound <= max) bounds.push(bound);
  }

  const last = geoStepFills.length - 1;
  const steps = bounds.map((from, index) => ({
    from,
    fill: geoStepFills[
      bounds.length === 1
        ? last
        : Math.round((index * last) / (bounds.length - 1))
    ],
  }));

  return {
    fill: (count) => {
      if (!Number.isFinite(count) || count <= 0) return geoNoDataFill;
      let step = steps[0];
      for (const candidate of steps) {
        if (count >= candidate.from) step = candidate;
      }
      return step.fill;
    },
    steps,
    max,
  };
}

// TopoJSON country name → API alias candidates. Only entries where the two
// disagree are listed; entries that match directly (e.g. "France", "Germany")
// fall through to the direct lookup. Sourced from world-atlas Natural Earth
// names paired against BV-BRC `isolation_country` values.
export const countryNameAliases: Partial<Record<string, readonly string[]>> = {
  "United States of America": ["USA", "United States", "US"],
  Russia: ["Russian Federation"],
  "Czech Republic": ["Czechia"],
  "Republic of Serbia": ["Serbia"],
  "Republic of the Congo": ["Congo"],
  "Democratic Republic of the Congo": ["DR Congo", "Congo (Kinshasa)"],
  "Ivory Coast": ["Cote d'Ivoire", "Côte d'Ivoire"],
  "United Republic of Tanzania": ["Tanzania"],
  "Bosnia and Herz.": ["Bosnia and Herzegovina"],
  Macedonia: ["North Macedonia"],
  "South Korea": ["Korea, South", "Republic of Korea"],
  "North Korea": ["Korea, North", "Democratic People's Republic of Korea"],
  Laos: ["Lao People's Democratic Republic"],
  Syria: ["Syrian Arab Republic"],
  Iran: ["Iran (Islamic Republic of)"],
  "United Kingdom": ["UK", "Great Britain", "England", "Scotland", "Wales"],
  "Falkland Is.": ["Falkland Islands"],
  "Solomon Is.": ["Solomon Islands"],
  "Eq. Guinea": ["Equatorial Guinea"],
  "S. Sudan": ["South Sudan"],
  "Central African Rep.": ["Central African Republic"],
  "W. Sahara": ["Western Sahara"],
  "Dominican Rep.": ["Dominican Republic"],
  "N. Cyprus": ["Northern Cyprus"],
  Vietnam: ["Viet Nam"],
  Brunei: ["Brunei Darussalam"],
  Tanzania: ["United Republic of Tanzania"],
  "Cape Verde": ["Cabo Verde"],
  Burma: ["Myanmar"],
  Palestine: ["State of Palestine", "Palestinian Territory"],
  eSwatini: ["Swaziland", "Eswatini"],
  Macao: ["Macau"],
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

export function lookupCountryCount(
  topoName: string,
  countryData: Record<string, number>,
): number {
  if (Object.prototype.hasOwnProperty.call(countryData, topoName)) {
    const direct = countryData[topoName];
    if (direct > 0) return direct;
  }

  const aliases = countryNameAliases[topoName];
  if (aliases) {
    for (const alias of aliases) {
      const count = countryData[alias];
      if (typeof count === "number" && count > 0) return count;
    }
  }

  const normalized = normalize(topoName);
  for (const [key, value] of Object.entries(countryData)) {
    if (normalize(key) === normalized) return value;
  }

  return 0;
}

export function resolveCountryDataKey(
  topoName: string,
  countryData: Record<string, number>,
): string | null {
  if (Object.prototype.hasOwnProperty.call(countryData, topoName) && countryData[topoName] > 0) {
    return topoName;
  }
  const aliases = countryNameAliases[topoName];
  if (aliases) {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(countryData, alias) && countryData[alias] > 0) {
        return alias;
      }
    }
  }
  const normalized = normalize(topoName);
  for (const key of Object.keys(countryData)) {
    if (normalize(key) === normalized) return key;
  }
  return null;
}

export const usaTopoNames = ["United States of America", "United States", "USA"] as const;

export function isUsaTopoName(name: string): boolean {
  return (usaTopoNames as readonly string[]).includes(name);
}
