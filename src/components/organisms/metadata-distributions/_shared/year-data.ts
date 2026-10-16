export interface YearDatum {
  year: number;
  count: number;
  /** The year's genomes, when the chart links its bars. */
  href?: string;
}

export function parseYearData(
  data: { label: string; value: number; href?: string }[],
): YearDatum[] {
  const years: YearDatum[] = [];
  for (const datum of data) {
    const year = Number(datum.label);
    if (datum.label.trim() && Number.isInteger(year) && year > 0) {
      years.push({ year, count: datum.value, href: datum.href });
    }
  }
  return years.sort((a, b) => a.year - b.year);
}

// Choose how many year labels to render along the x-axis so they don't overlap.
export function labelStep(count: number): number {
  if (count <= 15) return 1;
  if (count <= 30) return 2;
  if (count <= 60) return 5;
  return 10;
}
