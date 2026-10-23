import Plugin from "@jbrowse/core/Plugin";
import type PluginManager from "@jbrowse/core/PluginManager";
import AdapterType from "@jbrowse/core/pluggableElementTypes/AdapterType";
import { featureAdapterConfig, sequenceAdapterConfig } from "./adapter-config";
import { BvbrcFeatureAdapter, BvbrcSequenceAdapter } from "./adapters";

/**
 * Registers the two BV-BRC adapters `buildGenomeBrowserConfig` names. The
 * classes are imported statically and handed over already resolved through
 * JBrowse 5's `getAdapterClass`: this module is reached only from the lazily
 * loaded `genome-browser-view.tsx`, so they join that chunk instead of
 * becoming a chunk of their own that the first track read waits a round trip
 * for.
 */
export class BvbrcGenomeBrowserPlugin extends Plugin {
  name = "BvbrcGenomeBrowserPlugin";

  install(pluginManager: PluginManager): void {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: "BvbrcFeatureAdapter",
          configSchema: featureAdapterConfig,
          adapterMetadata: { hiddenFromGUI: true },
          getAdapterClass: () => Promise.resolve(BvbrcFeatureAdapter),
        }),
    );
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: "BvbrcSequenceAdapter",
          configSchema: sequenceAdapterConfig,
          adapterMetadata: { hiddenFromGUI: true },
          getAdapterClass: () => Promise.resolve(BvbrcSequenceAdapter),
        }),
    );
  }
}
