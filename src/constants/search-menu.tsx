import {
  Activity,
  Atom,
  Binary,
  Database,
  Dna,
  Eye,
  FlaskConical,
  Globe,
  ListTree,
  Puzzle,
  Share2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

/**
 * The legacy `/search` left-hand type menu, rendered by
 * `src/app/search/typesearch.tsx`.
 *
 * Every entry must have a destination: a canonical route (via its descriptor in
 * `./search-info`), or a legacy `tabs` marker, which `resolveLegacySearch`
 * reads as "this type still reaches the legacy list". `TypeSearch` no longer
 * renders a tab group — it lists the routed type as its one resource. Overview,
 * Phylogeny, Specialty Genes, Pathways, and Subsystems used to sit here with no
 * destination at all and resolved to a literal fallback screen; they are out
 * until something implements them. Their descriptors stay in `search-info.ts`
 * because the all-data-types result page still queries them.
 *
 * It lives beside the descriptors rather than in `typesearch.tsx` so that
 * `search-type-routing.test.ts` — which asserts every visible entry resolves to
 * a real destination — can read the menu without importing the whole legacy
 * client tree (`ListData` → `FilterBar` → `FacetPanel`, `GenomeDetailPanel`).
 */
export const searchTypeMenuItems = [
  { key: "taxonomy", label: "Taxa", icon: <Binary className="size-4" /> },
  { key: "genome", label: "Genomes", icon: <Dna className="size-4" /> },
  {
    key: "genome_amr",
    label: "AMR Phenotypes",
    icon: <ShieldCheck className="size-4" />,
  },
  {
    key: "genome_sequence",
    label: "Sequences",
    icon: <Database className="size-4" />,
  },
  {
    key: "genome_feature",
    label: "Features",
    icon: <ListTree className="size-4" />,
  },
  { key: "protein", label: "Proteins", icon: <Atom className="size-4" /> },
  {
    key: "protein_structure",
    label: "Protein Structures",
    icon: <Waypoints className="size-4" />,
  },
  {
    key: "protein_feature",
    label: "Domains and Motifs",
    icon: <Puzzle className="size-4" />,
  },
  { key: "epitope", label: "Epitopes", icon: <Activity className="size-4" /> },
  { key: "strain", label: "Strains", icon: <Share2 className="size-4" /> },
  {
    key: "surveillance",
    label: "Surveillance",
    icon: <Eye className="size-4" />,
  },
  { key: "serology", label: "Serology", icon: <Globe className="size-4" /> },
  {
    key: "experiment",
    label: "Experiments",
    icon: <FlaskConical className="size-4" />,
  },
];
