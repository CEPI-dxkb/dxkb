import Link from "next/link";

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
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold">Services</h1>
      <p className="text-muted-foreground mt-2">
        Browse bioinformatics services by category.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {serviceCategories.map((c) => (
          <li key={c.label} className="rounded-md border p-4">
            <Link href={c.href} className="font-medium hover:underline">
              {c.label}
            </Link>
            <p className="text-muted-foreground mt-1 text-sm">{c.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
