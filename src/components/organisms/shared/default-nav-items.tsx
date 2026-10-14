import type { ComponentType, ReactNode } from "react";

import { makePlaceholderView as placeholderView } from "@/components/organisms/shared/make-placeholder-view";
import { viewIcons } from "@/components/views/view-icons";
import type {
  OrganismLandingView,
  OrganismViewKey,
} from "@/components/organisms/types";

export interface DefaultViewDescriptor {
  key: OrganismViewKey;
  label: string;
  icon: ReactNode;
  description?: string;
}

export const defaultViewDescriptors: readonly DefaultViewDescriptor[] = [
  { key: "overview", label: "Overview", icon: viewIcons.overview },
  {
    key: "phylogeny",
    label: "Phylogeny",
    icon: viewIcons.phylogeny,
    description:
      "Phylogeny data and visualization are planned for a follow-up view.",
  },
  {
    key: "taxa-tree",
    label: "Taxa Tree",
    icon: viewIcons.taxonomy,
    description:
      "Taxa Tree browsing is stubbed while the overview data panels are brought online.",
  },
  {
    key: "genomes",
    label: "Genomes",
    icon: viewIcons.genomes,
    description:
      "Genome table filtering and pagination are planned for a dedicated follow-up view.",
  },
  { key: "sequences", label: "Sequences", icon: viewIcons.sequences },
  { key: "features", label: "Features", icon: viewIcons.features },
  {
    key: "protein-structures",
    label: "Protein Structures",
    icon: viewIcons.proteinStructures,
  },
  {
    key: "domains-and-motifs",
    label: "Domains and Motifs",
    icon: viewIcons.domainsAndMotifs,
  },
  { key: "epitopes", label: "Epitopes", icon: viewIcons.epitopes },
  {
    key: "experiments",
    label: "Experiments",
    icon: viewIcons.experiments,
  },
  {
    key: "interactions",
    label: "Interactions",
    icon: viewIcons.interactions,
  },
];

export type NavItemOverride =
  { Component: ComponentType } | { description?: string };

export type NavItemOverrides = Partial<
  Record<OrganismViewKey, NavItemOverride>
>;

interface BuildOrganismNavItemsOptions {
  exclude?: readonly OrganismViewKey[];
}

export function buildOrganismNavItems(
  overrides: NavItemOverrides = {},
  options: BuildOrganismNavItemsOptions = {},
): OrganismLandingView[] {
  const excluded = new Set(options.exclude ?? []);
  const items: OrganismLandingView[] = [];
  for (const descriptor of defaultViewDescriptors) {
    if (excluded.has(descriptor.key)) continue;
    const override = overrides[descriptor.key];
    if (override && "Component" in override) {
      items.push({
        key: descriptor.key,
        label: descriptor.label,
        icon: descriptor.icon,
        Component: override.Component,
      });
      continue;
    }
    const description =
      override && "description" in override
        ? override.description
        : descriptor.description;
    items.push({
      key: descriptor.key,
      label: descriptor.label,
      icon: descriptor.icon,
      Component: placeholderView(descriptor.label, description),
    });
  }
  return items;
}
