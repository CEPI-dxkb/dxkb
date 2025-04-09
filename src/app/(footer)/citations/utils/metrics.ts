import { Citation, YearMetrics } from "../data/types";

export function calculateMetrics(citations: Citation[]) {
  const totalCitations = citations.reduce((sum, citation) => sum + citation.citationCount, 0);
  const averageImpactFactor = citations.reduce((sum, citation) => sum + citation.impactFactor, 0) / citations.length;

  // Calculate citations by year
  const citationsByYear: Record<number, number> = {};
  citations.forEach((citation) => {
    citationsByYear[citation.year] = (citationsByYear[citation.year] || 0) + 1;
  });

  // Calculate metrics by year
  const metricsByYear: Record<number, YearMetrics> = {};
  citations.forEach((citation) => {
    if (!metricsByYear[citation.year]) {
      metricsByYear[citation.year] = {
        count: 0,
        totalCitations: 0,
        avgImpact: 0,
      };
    }
    metricsByYear[citation.year].count++;
    metricsByYear[citation.year].totalCitations += citation.citationCount;
    metricsByYear[citation.year].avgImpact += citation.impactFactor;
  });

  // Calculate average impact factor for each year
  Object.keys(metricsByYear).forEach((year) => {
    const yearMetrics = metricsByYear[Number(year)];
    yearMetrics.avgImpact = yearMetrics.avgImpact / yearMetrics.count;
  });

  // Get unique years
  const uniqueYears = [...new Set(citations.map((citation) => citation.year))].sort((a, b) => a - b);

  return {
    totalCitations,
    averageImpactFactor,
    citationsByYear,
    metricsByYear,
    uniqueYears,
  };
} 