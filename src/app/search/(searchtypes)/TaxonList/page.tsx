"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import React from 'react';
import { useSearchParams } from "next/navigation";
import { TaxaData } from "../../(searchdata)/TaxaData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function Taxa() {

    const searchParams = useSearchParams();
    const q = searchParams.get('q');
    const { setSelectedRows } = useSelection();

    return(
         <WithGenomePanel tabs={['taxa']}>
           {({ activeTab, setActiveTab }) => (
          <Tabs className="h-[85vh]" value={activeTab} onValueChange={setActiveTab} >
            <TabsList className="pb-0 mb-0 bg-background">
            <TabsTrigger 
                value="taxa" 
                className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
                >
                Taxa
            </TabsTrigger>
          </TabsList>
          <TabsContent value="taxa" className="border-0 mt-0 px-0 pt-[5px] flex-1 flex flex-col overflow-hidden">
            <TaxaData q={{q}} 
               onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
          )}
        </WithGenomePanel>
    );
}; 
