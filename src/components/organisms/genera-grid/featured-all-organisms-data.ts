import { taxonomyHref as taxonUrl } from "@/lib/views/hrefs";

export interface FeaturedOrganismEntry {
  name: string;
  href: string;
}

export interface FeaturedOrganismCategory {
  title: string;
  organisms: FeaturedOrganismEntry[];
}

export const featuredAllOrganisms: FeaturedOrganismCategory[] = [
  {
    // Viruses sit beside the three domains rather than inside them: they are
    // not cellular life, but the platform treats them as a top-level group.
    title: "Domains and Viruses",
    organisms: [
      { name: "Bacteria", href: taxonUrl(2) },
      { name: "Archaea", href: taxonUrl(2157) },
      { name: "Eukaryota", href: taxonUrl(2759) },
      { name: "Viruses", href: taxonUrl(10239) },
    ],
  },
  {
    title: "Viruses",
    organisms: [
      { name: "Coronaviridae", href: taxonUrl(11118) },
      { name: "Orthomyxoviridae", href: taxonUrl(11308) },
      { name: "Flaviviridae", href: taxonUrl(11050) },
      { name: "Filoviridae", href: taxonUrl(11266) },
    ],
  },
  {
    title: "Animals",
    organisms: [
      { name: "Metazoa", href: taxonUrl(33208) },
      { name: "Vertebrata", href: taxonUrl(7742) },
      { name: "Mammalia", href: taxonUrl(40674) },
    ],
  },
  {
    title: "Bacteria",
    organisms: [
      { name: "Proteobacteria", href: taxonUrl(1224) },
      { name: "Firmicutes", href: taxonUrl(1239) },
      { name: "Actinomycetota", href: taxonUrl(201174) },
      { name: "Cyanobacteria", href: taxonUrl(1117) },
    ],
  },
  {
    title: "Archaea",
    organisms: [
      { name: "Euryarchaeota", href: taxonUrl(28890) },
      { name: "Crenarchaeota", href: taxonUrl(28889) },
    ],
  },
];
