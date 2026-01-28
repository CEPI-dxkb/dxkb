"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ListData } from "@/components/services/ListData";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

// ---- Props interface ----
export interface TypeSearchProps {
  q?: string | null;
  searchtype?: string | null;
}

// ---- Type for search types ----
interface SearchTypesMap {
  [category: string]: {
    [term: string]: string; // term label
  };
}

export function TypeSearch({ q, searchtype }: TypeSearchProps) {
  const searchParams = useSearchParams();

  // derive url params into state so changes cause rerenders
  const [urlQ, setUrlQ] = useState<string>(q ?? searchParams.get("q") ?? "");
  const [urlType, setUrlType] = useState<string>(searchtype ?? searchParams.get("searchtype") ?? "");

  useEffect(() => {
    setUrlQ(q ?? searchParams.get("q") ?? "");
    setUrlType(searchtype ?? searchParams.get("searchtype") ?? "");
  }, [q, searchtype, searchParams.toString()]);

  // fallback map
  const searchTypes: SearchTypesMap = {
    genome: {
      genome: "Genomes",
      genome_sequence: "Sequences",
      genome_amr: "AMR Phenotypes",
      genome_feature: "Features",
    },
    genome_feature: {
      genome_feature: "Genome Features",
    },
    epitope: {
      epitope: "Epitopes",
    },
    experiment: {
      experiment: "Experiments",
      bioset: "Biosets",
    },
    protein_feature: {
      protein_feature: "Domains and Motifs",
    },
    protein_structure: {
      protein_structure: "Protein Structures",
    },
    serology: {
      serology: "Serology",
    },
    strain: {
      strain: "Strains",
    },
    surveillance: {
      surveillance: "Surveillance",
    },
    taxonomy: {
      taxonomy: "Taxa",
    },
  };

  // Determine which tab group to render based on urlType (thistype)
  const thistype = urlType || "genome";
  const tabsForType = searchTypes[thistype] ?? searchTypes["genome"];
  const tablist = Object.keys(tabsForType);

  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  
  // Track previous values to detect actual changes
  const prevUrlTypeRef = useRef<string>(urlType);
  const prevUrlQRef = useRef<string>(urlQ);

  // Clear selection only when searchtype or query actually changes
  useEffect(() => {
    const urlTypeChanged = prevUrlTypeRef.current !== urlType;
    const urlQChanged = prevUrlQRef.current !== urlQ;
    
    if (urlTypeChanged || urlQChanged) {
      console.log('Clearing selection due to URL change');
      setRowSelection({});
      setSelectedRows([]);
      prevUrlTypeRef.current = urlType;
      prevUrlQRef.current = urlQ;
    }
  }, [urlType, urlQ]);

  // render prop from WithGenomePanel gives us activeTab + setActiveTab.
  // We'll use an inner component so we can use useEffect to call setActiveTab
  function TabsRenderer({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (v: string) => void; }) {
    // Whenever urlType (searchtype) changes, set the active tab.
    // If urlType matches one of the tabs (term), set that; otherwise pick the first tab.
    useEffect(() => {
      // prefer to activate the specific term requested by searchtype if valid,
      // otherwise default to the first tab in the current tablist.
      const desired = urlType ?? "genome";
      // If desired corresponds to a tab term in this tabsForType group, use it;
      // otherwise default to the first of tablist.
      const targetTab = tablist.includes(desired) ? desired : tablist[0];
      if (targetTab && targetTab !== activeTab) {
        setActiveTab(targetTab);
      }
      // also, if q changes and there is no searchtype, ensure at least the first tab is active
      if (!urlType && urlQ && tablist[0] !== activeTab) {
        setActiveTab(tablist[0]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlType, urlQ, tablist.join(",")]); // tablist.join used to keep dependency simple

    const encodedQ = encodeURIComponent(urlQ);
    const fullQ = "keyword(" + encodedQ + ")";

    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[85vh]">
        <TabsList className="pb-0 mb-0 bg-background">
          {Object.entries(tabsForType).map(([term, label]) => (
            <TabsTrigger key={term} value={term} className="...">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(tabsForType).map((term) => (
          <TabsContent
            key={`${term}-${urlQ}-${urlType}`}
            value={term}
            className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden"
          >
            <ListData
              key={`${term}-${urlQ}-${urlType}`}
              resource={term}
              q={fullQ}
              onSelectionChange={setSelectedRows}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  // Main return: hand off rendering to WithGenomePanel which provides activeTab & setter
  return (
    <WithGenomePanel
      tabs={tablist}
      selectedRows={selectedRows}
      setSelectedRows={setSelectedRows}
    >
      {({ activeTab, setActiveTab }) => (
        <TabsRenderer activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </WithGenomePanel>
  );
}