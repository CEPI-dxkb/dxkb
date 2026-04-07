const gettingStartedItems: {
  title: string;
  href: string;
  description: string;
  target: "_self" | "_blank";
}[] = [
  {
    title: "Introduction",
    description: "Introduction to DXKB.",
    href: "/introduction",
    target: "_self",
  },
  {
    title: "Installation",
    description: "Installation instructions for DXKB.",
    href: "/installation",
    target: "_self",
  },
  {
    title: "Documentation",
    description: "Documentation for DXKB.",
    href: "https://docs.dxkb.org",
    target: "_blank",
  },
];

const organismItems: {
  title: string;
  href: string;
  description: string;
  target: "_self" | "_blank";
}[] = [
  {
    title: "Viruses",
    href: "/organisms/viruses",
    description: "Webpage for all viruses.",
    target: "_self",
  },
  {
    title: "Bacteria",
    href: "/organisms/bacteria",
    description: "Webpage for all bacteria.",
    target: "_self",
  },
  {
    title: "Fungi",
    href: "/organisms/fungi",
    description: "Webpage for all fungi.",
    target: "_self",
  },
  {
    title: "Browse All",
    href: "/organisms/all",
    description: "Webpage for all organisms.",
    target: "_self",
  },
];

const serviceItems = {
  genomics: {
    title: "Genomics",
    items: [
      {
        title: "BLAST",
        href: "/services/blast",
        target: "_self",
      },
      {
        title: "Genome Alignment",
        href: "/services/genome-alignment",
        target: "_self",
      },
      {
        title: "Genome Annotation",
        href: "/services/genome-annotation",
        target: "_self",
      },
      {
        title: "Genome Assembly",
        href: "/services/genome-assembly",
        target: "_self",
      },
      {
        title: "Primer Design",
        href: "/services/primer-design",
        target: "_self",
      },
      {
        title: "Similar Genome Finder",
        href: "/services/similar-genome-finder",
        target: "_self",
      },
      {
        title: "Variation Analysis",
        href: "/services/variation-analysis",
        target: "_self",
      },
    ],
  },
  phylogenomics: {
    title: "Phylogenomics",
    items: [
      {
        title: "Viral Genome Tree",
        href: "/services/viral-genome-tree",
        target: "_self",
      },
    ],
  },
  proteinTools: {
    title: "Protein Tools",
    items: [
      {
        title: "Gene/Protein Tree",
        href: "/services/gene-protein-tree",
        target: "_self",
      },
      {
        title: "MSA and SNP Analysis",
        href: "/services/msa-snp-analysis",
        target: "_self",
      },
      {
        title: "Meta-CATS",
        href: "/services/meta-cats",
        target: "_self",
      },
      {
        title: "Proteome Comparison",
        href: "/services/proteome-comparison",
        target: "_self",
      },
    ],
  },
  utilities: {
    title: "Utilities",
    items: [
      {
        title: "FastQ Utilities",
        href: "/services/fastq-utilities",
        target: "_self",
      },
    ],
  },
  metagenomics: {
    title: "Metagenomics",
    items: [
      {
        title: "Metagenomic Binning",
        href: "/services/metagenomic-binning",
        target: "_self",
      },
      {
        title: "Metagenomic Read Mapping",
        href: "/services/metagenomic-read-mapping",
        target: "_self",
      },
      {
        title: "Taxonomic Classification",
        href: "/services/taxonomic-classification",
        target: "_self",
      },
    ],
  },
  
  viralTools: {
    title: "Viral Tools",
    items: [
      {
        title: "Influenza HA Subtype Conversion",
        href: "/services/influenza-ha-subtype",
        target: "_self",
      },
      {
        title: "SARS-CoV-2 Genome Analysis",
        href: "/services/sars-cov2-genome-analysis",
        target: "_self",
      },
      {
        title: "SARS-CoV-2 Wastewater Analysis",
        href: "/services/sars-cov2-wastewater-analysis",
        target: "_self",
      },
      {
        title: "Subspecies Classification",
        href: "/services/subspecies-classification",
        target: "_self",
      },
      {
        title: "Viral Assembly",
        href: "/services/viral-assembly",
        target: "_self",
      },
    ],
  },
  outbreakTracker: {
    title: "BV-BRC Outbreak Tracker",
    items: [
      {
        title: "Measles 2025",
        href: "https://www.bv-brc.org/outbreaks/Measles/#view_tab=overview",
        target: "_blank",
      },
      {
        title: "Influenza H5N1 2024",
        href: "https://www.bv-brc.org/outbreaks/H5N1/#view_tab=overview",
        target: "_blank",
      },
      {
        title: "Mpox 2024",
        href: "https://www.bv-brc.org/outbreaks/Mpox/#view_tab=overview",
        target: "_blank",
      },
      {
        title: "SARS-CoV-2",
        href: "https://www.bv-brc.org/outbreaks/SARSCoV2/#view_tab=overview",
        target: "_blank",
      },
    ],
  },
} as const;

interface WorkspaceNavItem {
  title: string;
  /** Static href or function that receives the encoded workspace username. */
  href: string | ((encodedUsername: string) => string);
  /** Whether the item requires authentication. Unauthenticated users get a sign-in redirect. */
  requiresAuth: boolean;
  /** Fallback href for unauthenticated users. Defaults to `/sign-in?redirect=/workspace`. */
  signInRedirect?: string;
}

interface WorkspaceNavSection {
  title: string;
  items: WorkspaceNavItem[];
}

const workspaceNavItems: Record<string, WorkspaceNavSection> = {
  workspaces: {
    title: "Workspaces",
    items: [
      { title: "Home", href: (u) => `/workspace/${u}/home`, requiresAuth: true },
      { title: "My Workspaces", href: (u) => `/workspace/${u}`, requiresAuth: true },
      { title: "Public Workspaces", href: "/workspace/public", requiresAuth: false },
      { title: "BV-BRC Workshop", href: "/workspace/public/ARWattam@patricbrc.org/BV-BRC%20Workshop", requiresAuth: false },
    ],
  },
  data: {
    title: "Data",
    items: [
      { title: "My Jobs", href: "/jobs", requiresAuth: true, signInRedirect: "/sign-in?redirect=/jobs" },
      { title: "My Genomes", href: (u) => `/workspace/${u}/home/.genomes`, requiresAuth: true },
      { title: "My Genome Groups", href: (u) => `/workspace/${u}/home/Genome%20Groups`, requiresAuth: true },
      { title: "My Feature Groups", href: (u) => `/workspace/${u}/home/Feature%20Groups`, requiresAuth: true },
    ],
  },
};

export type { WorkspaceNavItem, WorkspaceNavSection };
export { gettingStartedItems, organismItems, serviceItems, workspaceNavItems };
