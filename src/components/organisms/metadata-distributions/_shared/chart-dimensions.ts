export const chartWidth = 540;
export const chartMarginTop = 10;
export const chartMarginRight = 20;
export const chartMarginBottom = 32;
export const chartMarginLeft = 72;

export const yearChartHeight = 260;
export const stackedChartHeight = 300;

export const yearInnerWidth = chartWidth - chartMarginLeft - chartMarginRight;
export const yearInnerHeight = yearChartHeight - chartMarginTop - chartMarginBottom;
export const stackedInnerHeight = stackedChartHeight - chartMarginTop - chartMarginBottom;

// The AMR chart is wider (full-width row, many labels); its bottom margin fits
// -45° rotated x-axis labels.
export const amrChartWidth = 920;
export const amrInnerWidth = amrChartWidth - chartMarginLeft - chartMarginRight;
export const amrChartHeight = 228;
export const amrMarginBottom = 90;
export const amrInnerHeight = amrChartHeight - chartMarginTop - amrMarginBottom;
