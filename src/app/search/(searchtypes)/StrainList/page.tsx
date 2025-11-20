"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { StrainData } from "../../(searchdata)/StrainData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function Strains() {

    const searchParams = useSearchParams();
    const q = searchParams.get("q");
    const { setSelectedRows } = useSelection();
    
    return(
        <WithGenomePanel tabs={['strains']}>
          {({ activeTab, setActiveTab }) => (
          <Tabs className="h-[85vh]" value={activeTab} onValueChange={setActiveTab} >
            <TabsList className="pb-0 mb-0 bg-background">
            <TabsTrigger 
                value="strains" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
              >
                Strains
              </TabsTrigger>
            </TabsList>
            <TabsContent value="strains" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
              <StrainData q={{q}}
               onSelectionChange={setSelectedRows} />
            </TabsContent>
          </Tabs>
          )}
        </WithGenomePanel>
    );
}; 
