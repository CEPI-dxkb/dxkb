"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { DomainsAndMotifData } from "../../(searchdata)/DomainsAndMotifsData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function DomainsAndMotifs() {

    const searchParams = useSearchParams();
    const q = searchParams.get("q");
    const { setSelectedRows } = useSelection();
    
    return(
        <WithGenomePanel tabs={['domainsandmotifs']}>
          {({ activeTab, setActiveTab }) => (
          <Tabs className="h-[85vh]" value={activeTab} onValueChange={setActiveTab} >
            <TabsList className="pb-0 mb-0 bg-background">
            <TabsTrigger 
                value="domainsandmotifs" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
              >
                Domains and Motifs
              </TabsTrigger>
            </TabsList>
            <TabsContent value="domainsandmotifs" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
              <DomainsAndMotifData q={{q}}
               onSelectionChange={setSelectedRows} />
            </TabsContent>
          </Tabs>
          )}
        </WithGenomePanel>
    );
}; 
