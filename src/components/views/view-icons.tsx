import {
  Activity,
  Binary,
  Blocks,
  CircleDashed,
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
 * The one icon per kind of view tab; add a new kind here, never at the call
 * site.
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
  circularViewer: <CircleDashed />,
  compareRegion: <GitCompareArrows />,
} as const satisfies Record<string, ReactNode>;

export type ViewIconKey = keyof typeof viewIcons;
