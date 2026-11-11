import {
  annotationTrackIds,
  genomeBrowserAnnotations,
  sequenceTrackId,
  type GenomeBrowserTrackId,
} from "@/lib/genome-browser/contract";
import type { GenomeBrowserTrackColors, JBrowseTheme } from "./theme";

/** No `rpc` slot: without `makeWorkerInstance` JBrowse runs on the main thread. */
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
            color: trackColors[annotation],
            labels: { description: "jexl:get(feature,'product')" },
          },
        ],
      };
    }),
    configuration: { theme },
  };
}

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
