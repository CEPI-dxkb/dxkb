"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { GenomeData } from "@/app/search/(searchdata)/GenomeListData/page";
import { FeatureData } from "@/app/search/(searchdata)/FeatureListData/page";
import { SequenceData } from "../../(searchdata)/SequenceData/page";
import { AMRPhenotypeData } from "../../(searchdata)/AMRPhenotypeData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function Genomes() {

  const searchParams = useSearchParams();
  const { setSelectedRows } = useSelection();
  const activeTabParam = searchParams.get('activeTab');

    return(
      <WithGenomePanel tabs={['genomes','sequences','amrphenotypes','features']}
        {...(activeTabParam ? { activeTab: activeTabParam } : {})}>
        {({ activeTab, setActiveTab }) => (
        <Tabs className="h-[85vh]" value={activeTab} onValueChange={setActiveTab} >
          <TabsList className="pb-0 mb-0 bg-background">
          <TabsTrigger 
              value="genomes" 
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              Genomes
            </TabsTrigger>
            <TabsTrigger 
              value="sequences" 
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              Sequences
            </TabsTrigger>
            <TabsTrigger 
              value="amrphenotypes" 
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              AMR Phenotypes
            </TabsTrigger>
            <TabsTrigger 
              value="features" 
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              Features
            </TabsTrigger>
          </TabsList>
          <TabsContent value="genomes" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <GenomeData onSelectionChange={setSelectedRows} />
          </TabsContent>
          <TabsContent value="sequences" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <SequenceData onSelectionChange={setSelectedRows} />
          </TabsContent>
          <TabsContent value="amrphenotypes" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <AMRPhenotypeData onSelectionChange={setSelectedRows} />
          </TabsContent>
          <TabsContent value="features" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <FeatureData onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
        )}
      </WithGenomePanel>
    );
}; 
