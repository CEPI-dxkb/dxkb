import { taxonomyHref } from "@/lib/views/hrefs";

export interface FeaturedVirus {
  name: string;
  href: string;
  /** aria-label suffix; "genomes" for genome-list targets, omitted (→ "overview") for taxonomy. */
  viewLabel?: string;
}

// Bacteriophages and Ebolavirus use multi-clause RQL filters no generic href
// builder covers, so their raw /genome?rql= literals are intentional.
export const featuredViruses: FeaturedVirus[] = [
  {
    name: "Bacteriophages",
    href: "/genome?rql=and(eq(genome_name,phage),eq(superkingdom,Viruses))",
    viewLabel: "genomes",
  },
  { name: "Dengue virus", href: taxonomyHref(3052464) },
  {
    name: "Ebolavirus",
    href: "/genome?rql=in(taxon_lineage_ids,(3044781,186536))",
    viewLabel: "genomes",
  },
  { name: "Enteroviruses", href: taxonomyHref(12059) },
  { name: "Hepatitis C virus", href: taxonomyHref(3052230) },
  { name: "Influenza A virus", href: taxonomyHref(2955291) },
  { name: "Lassa virus", href: taxonomyHref(3052310) },
  { name: "Measles virus", href: taxonomyHref(3052345) },
  { name: "Monkeypox Virus", href: taxonomyHref(10244) },
  { name: "SARS-CoV-2", href: taxonomyHref(2697049) },
  { name: "Zika Virus", href: taxonomyHref(3048459) },
];
