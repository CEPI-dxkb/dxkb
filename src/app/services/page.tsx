import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ServiceHeader } from "@/components/services/service-header";

interface ServiceCategory {
  label: string;
  description: string;
  href: string;
}

const serviceCategories: ServiceCategory[] = [
  {
    label: "Genomics",
    description: "Assembly, annotation, alignment, and variation tools.",
    href: "/services/genome-assembly",
  },
  {
    label: "Metagenomics",
    description: "Binning, read mapping, and taxonomic classification.",
    href: "/services/metagenomic-binning",
  },
  {
    label: "Phylogenomics",
    description: "Viral genome trees and phylogenetic analyses.",
    href: "/services/viral-genome-tree",
  },
  {
    label: "Protein Tools",
    description: "Gene/protein trees, MSA, SNP, and Meta-CATS.",
    href: "/services/gene-protein-tree",
  },
  {
    label: "Utilities",
    description: "FASTQ utilities and supporting workflows.",
    href: "/services/fastq-utilities",
  },
  {
    label: "Viral Tools",
    description: "Influenza HA subtyping, SARS-CoV-2, and viral assembly.",
    href: "/services/viral-assembly",
  },
];

export default function ServicesIndexPage() {
  return (
    <section>
      <ServiceHeader
        title="Services"
        description="Browse bioinformatics services by category."
      />
      {/* `has-focus-visible` shows the ring only on keyboard focus; forced-colors drops the box-shadow ring, so `focus-visible:outline-hidden` paints an outline there. */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {serviceCategories.map((c) => (
          <li
            key={c.label}
            className="group relative flex items-start justify-between gap-3 rounded-md border bg-card p-4 transition-colors hover:border-muted-foreground/70 hover:bg-background has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <div>
              <Link
                href={c.href}
                className="font-medium group-hover:underline after:absolute after:inset-0 focus-visible:outline-hidden"
              >
                {c.label}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.description}
              </p>
            </div>
            <ArrowRight
              aria-hidden="true"
              className="pointer-events-none mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
