"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { SerologyData } from "../../(searchdata)/SerologyData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function Serology() {
  const { setSelectedRows } = useSelection();

  return (
    <WithGenomePanel tabs={["serology"]}>
      {({ activeTab, setActiveTab }) => (
        <Tabs
          className="h-[85vh]"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="bg-background mb-0 pb-0">
            <TabsTrigger
              value="serology"
              className="bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary mx-[2px]"
            >
              Serology
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="serology"
            className="mt-0 flex flex-1 flex-col overflow-hidden border-0 px-0 pt-[5px]"
          >
            <SerologyData onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
      )}
    </WithGenomePanel>
  );
}
