import {
  BaseFeatureDataAdapter,
  BaseSequenceAdapter,
} from "@jbrowse/core/data_adapters/BaseAdapter";
import type { BaseOptions } from "@jbrowse/core/data_adapters/BaseAdapter/types";
import { checkAbortSignal } from "@jbrowse/core/util/aborting";
import { ObservableCreate } from "@jbrowse/core/util/rxjs";
import SimpleFeature, {
  type Feature,
  type SimpleFeatureSerialized,
} from "@jbrowse/core/util/simpleFeature";
import type { NoAssemblyRegion } from "@jbrowse/core/util/types";
import {
  loadGenomeBrowserFeatures,
  loadGenomeBrowserRegions,
  loadGenomeBrowserSequence,
} from "@/lib/genome-browser/client";
import {
  isGenomeBrowserAnnotation,
  type GenomeBrowserFeature,
} from "@/lib/genome-browser/contract";
import { featureHref } from "@/lib/views/hrefs";
import type {
  BvbrcFeatureAdapterConfig,
  BvbrcSequenceAdapterConfig,
} from "./adapter-config";

/**
 * DOM-free so they would run unchanged in a JBrowse RPC worker;
 * `checkAbortSignal` drops an aborted render's result instead of cancelling a
 * shared fetch.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function featureDetails({
  subfeatures,
  ...feature
}: GenomeBrowserFeature): SimpleFeatureSerialized {
  return {
    ...feature,
    // A spread copy is an object literal type with the index signature
    // `SimpleFeatureSerialized` requires; the interface has none.
    ...(subfeatures
      ? { subfeatures: subfeatures.map((subfeature) => ({ ...subfeature })) }
      : {}),
    feature_view: `<a href="${escapeHtml(featureHref(feature.feature_id))}">Open Feature View</a>`,
  };
}

export class BvbrcFeatureAdapter extends BaseFeatureDataAdapter<BvbrcFeatureAdapterConfig> {
  async getRefNames(): Promise<string[]> {
    const regions = await loadGenomeBrowserRegions(this.getConf("genomeId"));
    return regions.map((region) => region.refName);
  }

  getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    // ObservableCreate forwards a rejected callback to observer.error.
    return ObservableCreate<Feature>(async (observer) => {
      const annotation = this.getConf("annotation");
      if (!isGenomeBrowserAnnotation(annotation)) {
        throw new Error(`Unknown annotation track: ${annotation}`);
      }
      // The route rejects a negative `start`, which a view panned past the left
      // edge asks for.
      const start = Math.max(0, query.start);
      if (query.end <= start) {
        observer.complete();
        return;
      }
      const features = await loadGenomeBrowserFeatures(
        { genomeId: this.getConf("genomeId"), annotation, refName: query.refName },
        start,
        query.end,
      );
      checkAbortSignal(opts.signal);
      for (const feature of features) {
        observer.next(new SimpleFeature(featureDetails(feature)));
      }
      observer.complete();
    }, opts.signal);
  }
}

export class BvbrcSequenceAdapter extends BaseSequenceAdapter<BvbrcSequenceAdapterConfig> {
  async getRefNames(): Promise<string[]> {
    return (await this.getRegions()).map((region) => region.refName);
  }

  async getRegions(): Promise<NoAssemblyRegion[]> {
    return loadGenomeBrowserRegions(this.getConf("genomeId"));
  }

  getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async (observer) => {
      // Clamped as in the feature adapter so `end = start + seq.length` stays
      // right.
      const start = Math.max(0, query.start);
      if (query.end <= start) {
        observer.complete();
        return;
      }
      const seq = await loadGenomeBrowserSequence(
        { genomeId: this.getConf("genomeId"), refName: query.refName },
        start,
        query.end,
      );
      checkAbortSignal(opts.signal);
      if (seq) {
        observer.next(
          new SimpleFeature({
            uniqueId: `${query.refName}:${String(start)}-${String(query.end)}`,
            refName: query.refName,
            start,
            end: start + seq.length,
            seq,
          }),
        );
      }
      observer.complete();
    }, opts.signal);
  }
}
