import Plugin from "@jbrowse/core/Plugin";
import type PluginManager from "@jbrowse/core/PluginManager";
import AdapterType from "@jbrowse/core/pluggableElementTypes/AdapterType";
import { featureAdapterConfig, sequenceAdapterConfig } from "./adapter-config";
import { BvbrcFeatureAdapter, BvbrcSequenceAdapter } from "./adapters";

/**
 * Classes are imported statically so they join the lazy view chunk instead of a
 * separate chunk the first track read waits a round trip for.
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
