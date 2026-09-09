"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useRef } from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { useSearchParams, useRouter } from "next/navigation";
import { ListData } from "@/components/services/list-data";
import { ResourceWorkspace } from "@/components/views/resource-workspace";
import { GenomeDetailPanel } from "@/components/genome/genome-detail-panel";
import {
  SearchActionBar,
  notReady,
} from "@/components/search/search-action-bar";
import { VerticalMenu } from "@/components/ui/vertical-menu";
import { Button } from "@/components/ui/button";
import {
  searchHref,
  searchTabsByType,
  searchTypes as searchDescriptors,
} from "@/constants/search-info";
import {
  experimentHref,
  experimentIdFromRow,
  featureHref,
  featureIdFromRow,
  genomeHref,
  genomeIdFromRow,
  proteinStructureHref,
  serologyHref,
  serologyIdFromRow,
  surveillanceHref,
  surveillanceIdFromRow,
} from "@/lib/views/hrefs";
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  Atom,
  Binary,
  Blocks,
  Database,
  Dna,
  Eye,
  FlaskConical,
  Globe,
  Layers,
  ListTree,
  Microscope,
  Network,
  Puzzle,
  Route,
  Share2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

// ---- Props interface ----
export interface TypeSearchProps {
  q?: string | null;
  searchtype?: string | null;
}

interface TabsRendererProps {
  activeTab: string;
  setActiveTab: (v: string) => void;
  urlType: string;
  urlQ: string;
  tabsForType: Readonly<Record<string, string>>;
  tablist: string[];
  rowSelection: RowSelectionState;
  setRowSelection: (selection: RowSelectionState) => void;
  pageIndex: number;
  setPageIndex: (page: number) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedGenomeId: (id: string | null) => void;
  setSelectedFeatureId: (id: string | null) => void;
  setSelectedExperimentId: (id: string | null) => void;
  setSelectedStructureHref: (href: string | null) => void;
  setSelectedSurveillanceHref: (href: string | null) => void;
  setSelectedSerologyHref: (href: string | null) => void;
  selectedIds: string[];
  isAllPagesSelected: boolean;
  setIsAllPagesSelected: (selected: boolean) => void;
  totalItems: number;
  setTotalItems: (total: number) => void;
}

// IMPORTANT: This must be defined at module scope (not inside TypeSearch),
// otherwise it gets a new identity on every TypeSearch re-render, which
// remounts the entire subtree and wipes ListData local state (sorting, etc).
function TabsRenderer({
  activeTab,
  setActiveTab,
  urlType,
  urlQ,
  tabsForType,
  tablist,
  rowSelection,
  setRowSelection,
  pageIndex,
  setPageIndex,
  setSelectedIds,
  setSelectedGenomeId,
  setSelectedFeatureId,
  setSelectedExperimentId,
  setSelectedStructureHref,
  setSelectedSurveillanceHref,
  setSelectedSerologyHref,
  selectedIds,
  isAllPagesSelected,
  setIsAllPagesSelected,
  setTotalItems,
}: TabsRendererProps) {
  const clearTimeoutRef = useRef<number | null>(null);

  const desiredTab = urlType || "genome";
  const urlDerivedTab = tablist.includes(desiredTab)
    ? desiredTab
    : (tablist[0] ?? "genome");

  // Sync the active tab when URL params change. activeTab is excluded from
  // deps so user-initiated tab clicks are not overridden — React's useState
  // already bails out when setActiveTab is called with the current value.
  useEffect(() => {
    setActiveTab(urlDerivedTab);
  }, [urlQ, urlDerivedTab, setActiveTab]);

  const encodedQ = encodeURIComponent(urlQ);
  const fullQ = "keyword(" + encodedQ + ")";

  // Handle tab change - clear selections when switching tabs
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setRowSelection({});
    setSelectedIds([]);
    setSelectedGenomeId(null);
    setSelectedFeatureId(null);
    setSelectedExperimentId(null);
    setSelectedStructureHref(null);
    setSelectedSurveillanceHref(null);
    setSelectedSerologyHref(null);
    setIsAllPagesSelected(false);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {tablist.length > 1 && (
        <TabsList className="mb-0 bg-background pb-0">
          {Object.entries(tabsForType).map(([term, label]) => (
            <TabsTrigger key={term} value={term}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {Object.keys(tabsForType).map((term) => (
        <TabsContent
          key={term}
          value={term}
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden border-0 px-0 pt-1"
        >
          <ListData
            resource={term}
            q={fullQ}
            selectedIds={selectedIds}
            onSelectionChange={(ids) => {
              if (!Array.isArray(ids)) return;

              // Debounce handling of empty selection notifications. Some
              // interactions/firehose events can emit a transient empty
              // selection which would immediately clear the user's
              // cross-page selection; to avoid that we wait briefly before
              // clearing so a follow-up selection can cancel the clear.

              // If there is a pending clear, cancel it whenever we get a new event
              if (clearTimeoutRef.current) {
                window.clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
              }

              if (ids.length === 0) {
                // Schedule clearing after a short delay unless another
                // selection arrives.
                clearTimeoutRef.current = window.setTimeout(() => {
                  setSelectedIds([]);
                  clearTimeoutRef.current = null;
                }, 120);
                return;
              }

              // Immediate merge for non-empty updates
              setSelectedIds((prev) => {
                const next = new Set(prev);
                const selectedIdSet = new Set(ids);

                // Add new ones
                selectedIdSet.forEach((id) => {
                  if (id) next.add(id);
                });

                // Remove ones that are no longer selected on this page
                prev.forEach((id) => {
                  if (!selectedIdSet.has(id)) {
                    next.delete(id);
                  }
                });

                return Array.from(next);
              });
            }}
            onSelectedRowChange={(row) => {
              setSelectedGenomeId(genomeIdFromRow(row));
              setSelectedFeatureId(featureIdFromRow(row));
              setSelectedExperimentId(experimentIdFromRow(row));
              const pdbId = row?.pdb_id;
              setSelectedStructureHref(
                typeof pdbId === "string" || typeof pdbId === "number"
                  ? proteinStructureHref(pdbId)
                  : null,
              );
              const surveillanceId = surveillanceIdFromRow(row);
              const pathogenTestType = row?.pathogen_test_type;
              setSelectedSurveillanceHref(
                surveillanceId
                  ? surveillanceHref(
                      surveillanceId,
                      typeof pathogenTestType === "string"
                        ? pathogenTestType
                        : Array.isArray(pathogenTestType) &&
                            pathogenTestType.length === 1 &&
                            typeof pathogenTestType[0] === "string"
                          ? pathogenTestType[0]
                          : undefined,
                    )
                  : null,
              );
              const serologyId = serologyIdFromRow(row);
              setSelectedSerologyHref(
                serologyId
                  ? serologyHref(
                      serologyId,
                      typeof row?.test_type === "string"
                        ? row.test_type
                        : undefined,
                    )
                  : null,
              );
            }}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            pageIndex={pageIndex}
            onPageChange={setPageIndex}
            isAllPagesSelected={isAllPagesSelected}
            onAllPagesSelectionChange={setIsAllPagesSelected}
            onTotalItemsChange={setTotalItems}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

const searchTypeMenuItems = [
  { key: "overview", label: "Overview", icon: <Blocks className="size-4" /> },
  {
    key: "phylogeny",
    label: "Phylogeny",
    icon: <Network className="size-4" />,
  },
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
    key: "sp_gene",
    label: "Specialty Genes",
    icon: <Microscope className="size-4" />,
  },
  {
    key: "protein_feature",
    label: "Domains and Motifs",
    icon: <Puzzle className="size-4" />,
  },
  { key: "epitope", label: "Epitopes", icon: <Activity className="size-4" /> },
  { key: "strain", label: "Strains", icon: <Share2 className="size-4" /> },
  { key: "pathway", label: "Pathways", icon: <Route className="size-4" /> },
  {
    key: "subsystem",
    label: "Subsystems",
    icon: <Layers className="size-4" />,
  },
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

export function TypeSearch({ q, searchtype }: TypeSearchProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Derive URL params directly to avoid extra state + rerender loops.
  const urlQ = q ?? searchParams.get("q") ?? "";
  const urlType = searchtype ?? searchParams.get("type") ?? "";

  const [menuCollapsed, setMenuCollapsed] = useState(false);

  // Determine which tab group to render based on urlType (thistype)
  const thistype = urlType || "genome";
  const tabsForType = searchTabsByType[thistype] ?? searchTabsByType["genome"];
  const tablist = Object.keys(tabsForType);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGenomeId, setSelectedGenomeId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  );
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(
    null,
  );
  const [selectedStructureHref, setSelectedStructureHref] = useState<
    string | null
  >(null);
  const [selectedSurveillanceHref, setSelectedSurveillanceHref] = useState<
    string | null
  >(null);
  const [selectedSerologyHref, setSelectedSerologyHref] = useState<
    string | null
  >(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [isAllPagesSelected, setIsAllPagesSelected] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  const urlKey = `${urlType}::${urlQ}`;
  const [prevUrlKey, setPrevUrlKey] = useState(urlKey);
  if (prevUrlKey !== urlKey) {
    setPrevUrlKey(urlKey);
    setRowSelection({});
    setSelectedIds([]);
    setSelectedGenomeId(null);
    setSelectedFeatureId(null);
    setSelectedExperimentId(null);
    setSelectedStructureHref(null);
    setSelectedSurveillanceHref(null);
    setSelectedSerologyHref(null);
    setPageIndex(0);
    setIsAllPagesSelected(false);
    setTotalItems(0);
  }

  const [activeTab, setActiveTab] = useState(tablist[0]);
  // Keep the side panel open for multi-selection: use the last selected id
  // as the active genome shown in the panel. This prevents the panel from
  // collapsing whenever the user selects an additional row while already
  // viewing details.
  const activeGenomeId =
    selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  const guideUrls: Record<string, string> = {
    genome:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/genome_table.html",
    strain:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/strains.html",
    genome_feature:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/features.html",
    protein_feature:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/features.html",
    epitope:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/epitopes.html",
    protein_structure:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/protein_structures.html",
    surveillance:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/surveillance_data.html",
    serology:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/serology_data.html",
    taxonomy: "https://www.bv-brc.org/docs/quick_references/",
    experiment:
      "https://www.bv-brc.org/docs/quick_references/organisms_taxon/experiments_comparisons_tables.html",
  };

  // The active top-level group: overview when no type is set, otherwise match
  // the urlType directly or find which group contains it as a sub-tab.
  let activeGroup = "overview";
  if (urlType && urlType !== "everything") {
    const directGroup = searchTypeMenuItems.find(
      (item) => item.key === urlType,
    );
    activeGroup =
      directGroup?.key ??
      searchTypeMenuItems.find((item) =>
        Object.hasOwn(searchTabsByType[item.key] ?? {}, urlType),
      )?.key ??
      "genome";
  }

  const menuItems = searchTypeMenuItems.map((item) => ({
    icon: item.icon,
    label: item.label,
    isActive: item.key === activeGroup,
    onClick: () => {
      const params = new URLSearchParams();
      if (item.key === "overview") {
        if (urlQ) params.set("q", urlQ);
        router.push(
          `/search${params.toString() ? `?${params.toString()}` : ""}`,
        );
      } else {
        const descriptor = searchDescriptors.find(
          (searchType) => searchType.id === item.key,
        );
        if (descriptor?.route.status === "canonical") {
          router.push(searchHref(descriptor, urlQ));
          return;
        }
        params.set("type", item.key);
        if (urlQ) params.set("q", urlQ);
        router.push(`/search?${params.toString()}`);
      }
    },
  }));

  // Main return:
  return (
    // Ensure this container fills the available height so child panels using
    // h-full can correctly constrain their inner scroll areas. Without an
    // explicit h-full some descendants may compute height auto and allow
    // children to expand the page (pushing the footer).
    <div className="flex h-full min-h-0 flex-1">
      {/* Left collapsible nav — compact card, self-sized like LandingNav */}
      <div className="shrink-0 scrollbar-none overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden">
        <div className="w-fit rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-end p-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setMenuCollapsed((c) => !c);
              }}
              title={
                menuCollapsed ? "Expand navigation" : "Collapse navigation"
              }
            >
              {menuCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </Button>
          </div>
          <div className="p-2 pt-0">
            <VerticalMenu items={menuItems} isCollapsed={menuCollapsed} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ResourceWorkspace
          hasSidePanel={!!activeGenomeId}
          actionBar={
            <SearchActionBar
              selectedCount={
                isAllPagesSelected ? totalItems : selectedIds.length
              }
              searchType={activeTab}
              guideUrl={guideUrls[activeTab]}
              // taxonOverview is enabled only in the taxon-view (which wires the
              // handler); /search has no handler yet, so keep it disabled here.
              disabledActions={{
                taxonOverview: notReady,
                genome:
                  activeTab === "protein_structure" && selectedGenomeId === null
                    ? "No genome is associated with this structure."
                    : undefined,
                feature:
                  activeTab === "protein_structure" && selectedFeatureId === null
                    ? "No feature is associated with this structure."
                    : undefined,
                structure:
                  selectedStructureHref === null
                    ? "A PDB accession is required to view this structure."
                    : undefined,
                serology:
                  selectedSerologyHref === null
                    ? "A public sample identifier is required to view serology details."
                    : undefined,
              }}
              onAction={(actionId) => {
                if (actionId === "genome" && selectedGenomeId) {
                  window.open(
                    genomeHref(selectedGenomeId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "feature" && selectedFeatureId) {
                  window.open(
                    featureHref(selectedFeatureId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "structure" && selectedStructureHref) {
                  window.open(
                    selectedStructureHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (
                  actionId === "experiment" &&
                  selectedExperimentId
                ) {
                  window.open(
                    experimentHref(selectedExperimentId),
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (
                  actionId === "surveillance" &&
                  selectedSurveillanceHref
                ) {
                  window.open(
                    selectedSurveillanceHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                } else if (actionId === "serology" && selectedSerologyHref) {
                  window.open(
                    selectedSerologyHref,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            />
          }
          sidePanel={
            <GenomeDetailPanel
              genomeId={activeGenomeId}
              activeTab={activeTab}
              selectedIds={selectedIds}
              isAllPagesSelected={isAllPagesSelected}
              totalItems={totalItems}
            />
          }
        >
          <TabsRenderer
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            urlType={urlType}
            urlQ={urlQ}
            tabsForType={tabsForType}
            tablist={tablist}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
            pageIndex={pageIndex}
            setPageIndex={setPageIndex}
            setSelectedIds={setSelectedIds}
            setSelectedGenomeId={setSelectedGenomeId}
            setSelectedFeatureId={setSelectedFeatureId}
            setSelectedExperimentId={setSelectedExperimentId}
            setSelectedStructureHref={setSelectedStructureHref}
            setSelectedSurveillanceHref={setSelectedSurveillanceHref}
            setSelectedSerologyHref={setSelectedSerologyHref}
            selectedIds={selectedIds}
            isAllPagesSelected={isAllPagesSelected}
            setIsAllPagesSelected={setIsAllPagesSelected}
            totalItems={totalItems}
            setTotalItems={setTotalItems}
          />
        </ResourceWorkspace>
      </div>
    </div>
  );
}
