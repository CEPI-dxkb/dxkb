/**
 * Pixel bounds and defaults of the Graph view's two side columns (the protein list on the left, the
 * selection details on the right). The columns' panels and the saved-preference schema read the
 * same numbers, so a saved width can never fall outside what a drag could produce. Import-free on
 * purpose: `src/lib/ui-preferences/definitions.ts` ships on every route.
 */
export const graphColumnLimits = {
  list: { min: 180, max: 420 },
  details: { min: 220, max: 560 },
} as const;

export const graphColumnDefaults = { list: 240, details: 256 } as const;

/** The least width the canvas between them keeps while a column is dragged. */
export const graphCanvasMinWidth = 320;
