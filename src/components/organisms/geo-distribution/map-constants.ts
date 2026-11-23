// The map's height before it is measured, and its floor (`min-h-131` in choropleth-svg.tsx).
export const mapHeight = 524;
export const countyPadding = 48;

// Zoom limits shared by <Zoom> and the country fit. @visx/zoom drops (does not clamp) a
// matrix whose scale is out of range, so the fit must clamp to the same numbers.
export const mapScaleMin = 0.6;
// 157 of the 177 countries in countries-110m.json need more than 10x to fill the map
// (their main landmass at countryFitPadding).
export const mapScaleMax = 32;
// Fraction of the viewport left empty on each side of a zoomed country.
export const countryFitPadding = 0.1;
export const countryZoomMs = 600;
// A ring joins the main landmass when its gap is under countryGapFactor times the
// biggest ring's longest side.
export const countryGapFactor = 1;
// A cap on that gap, as a multiple of the projection scale. It is a safety net: no
// country in countries-110m.json reaches it (every ring scales with the projection, so
// the ratio does not depend on the viewport), but a larger-than-world ring would.
export const countryReachScale = 0.6;
