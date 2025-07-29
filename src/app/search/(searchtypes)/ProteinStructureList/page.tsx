"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { ProteinStructureData } from "../../(searchdata)/ProteinStructureData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function ProteinStructures() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');
    const { setSelectedRows } = useSelection();

    return(
        <WithGenomePanel tabs={['proteinstructures']}>
          {({ activeTab, setActiveTab }) => (
          <Tabs className="h-[85vh]" value={activeTab} onValueChange={setActiveTab} >
            <TabsList className="pb-0 mb-0 bg-background">
            <TabsTrigger 
                value="proteinstructures" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Protein Structures
            </TabsTrigger>
          </TabsList>
          <TabsContent value="proteinstructures" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <ProteinStructureData q={{q}} 
               onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
          )}
        </WithGenomePanel>
    );
}; 
