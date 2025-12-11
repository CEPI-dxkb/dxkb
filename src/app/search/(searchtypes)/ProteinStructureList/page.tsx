"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { ProteinStructureData } from "../../(searchdata)/ProteinStructureData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function ProteinStructures() {
  const { setSelectedRows } = useSelection();

  return (
    <WithGenomePanel tabs={["proteinstructures"]}>
      {({ activeTab, setActiveTab }) => (
        <Tabs
          className="h-[85vh]"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="bg-background mb-0 pb-0">
            <TabsTrigger
              value="proteinstructures"
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              Protein Structures
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="proteinstructures"
            className="mt-0 flex flex-1 flex-col overflow-hidden border-0 px-0 pt-[5px]"
          >
            <ProteinStructureData onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
      )}
    </WithGenomePanel>
  );
}
