import {
  annotationTrackIds,
  genomeBrowserAnnotations,
  sequenceTrackId,
  type GenomeBrowserTrackId,
} from "@/lib/genome-browser/contract";
import type { GenomeBrowserTrackColors, JBrowseTheme } from "./theme";

/**
 * The JBrowse 5 configuration for one genome: an assembly named after the
 * genome whose reference sequence track is legacy's `refseqs`, legacy's two
 * annotation tracks, and the app theme. Plain objects only, so it is testable
 * without loading JBrowse. No `rpc` slot: with no `makeWorkerInstance` JBrowse
 * runs on the main thread (plan decision 4).
 */
export function buildGenomeBrowserConfig({
  genomeId,
  trackColors,
  theme,
}: {
  genomeId: string;
  trackColors: GenomeBrowserTrackColors;
  theme: JBrowseTheme;
}) {
  return {
    assembly: {
      name: genomeId,
      sequence: {
        type: "ReferenceSequenceTrack",
        trackId: sequenceTrackId,
        name: "Reference Sequence",
        adapter: { type: "BvbrcSequenceAdapter", genomeId },
      },
    },
    tracks: genomeBrowserAnnotations.map((annotation) => {
      const trackId = annotationTrackIds[annotation];
      return {
        type: "FeatureTrack",
        trackId,
        name: `${annotation} Annotation`,
        assemblyNames: [genomeId],
        category: ["Gene and Protein"],
        adapter: { type: "BvbrcFeatureAdapter", genomeId, annotation },
        displays: [
          {
            type: "LinearBasicDisplay",
            displayId: `${trackId}-LinearBasicDisplay`,
            // Display-level in JBrowse 5 (v4's `renderer.color1`).
            color: trackColors[annotation],
            // Legacy's second label line: the product.
            labels: { description: "jexl:get(feature,'product')" },
          },
        ],
      };
    }),
    configuration: { theme },
  };
}

/**
 * JBrowse 5's `view` option: where to open, which tracks to show and what to
 * highlight, read once when the engine is built.
 */
export function buildGenomeBrowserView({
  location,
  tracks,
  highlight,
}: {
  location: string;
  tracks: readonly GenomeBrowserTrackId[];
  highlight?: string;
}) {
  return {
    loc: location,
    tracks: [...tracks],
    ...(highlight ? { highlight: [highlight] } : {}),
  };
}
