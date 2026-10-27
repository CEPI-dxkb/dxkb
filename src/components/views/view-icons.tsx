import {
  Activity,
  Binary,
  Blocks,
  ChartNoAxesCombined,
  Database,
  Dna,
  FlaskConical,
  GitBranch,
  GitCompareArrows,
  Handshake,
  ListTree,
  Microscope,
  Network,
  Puzzle,
  Radar,
  ScanLine,
  Shapes,
  ShieldCheck,
  Shuffle,
  TestTube,
  TestTubes,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one icon for each kind of view tab. Every view rail takes its icons from
 * here: the organism and taxon pages, each list and member page under
 * `(views)`, and the All Data Types search's data types. So a data type shows
 * the same icon wherever it appears; a tab whose key differs between pages
 * (`structures` on the Genome list, `protein-structures` on a taxon) still
 * names the same entry. A new kind of tab adds its icon here, never at the
 * call site.
 */
export const viewIcons = {
  overview: <Blocks />,
  phylogeny: <Network />,
  taxonomy: <ListTree />,
  strains: <GitBranch />,
  genomes: <Dna />,
  amrPhenotypes: <ShieldCheck />,
  sequences: <Database />,
  features: <Binary />,
  proteins: <Shapes />,
  proteinStructures: <Waypoints />,
  domainsAndMotifs: <Puzzle />,
  sfvt: <Shuffle />,
  epitopes: <Activity />,
  assays: <Microscope />,
  experiments: <FlaskConical />,
  biosets: <TestTubes />,
  surveillance: <Radar />,
  serology: <TestTube />,
  interactions: <Handshake />,
  genomeBrowser: <ScanLine />,
  compareRegion: <GitCompareArrows />,
  transcriptomics: <ChartNoAxesCombined />,
} as const satisfies Record<string, ReactNode>;

export type ViewIconKey = keyof typeof viewIcons;
