"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { SurveillanceData } from "../../(searchdata)/SurveillanceData/page";
import { useSelection } from "../SelectionContext";
import { WithGenomePanel } from "@/components/layouts/WithGenomePanel";

export default function Surveillance() {
  const { setSelectedRows } = useSelection();

  return (
    <WithGenomePanel tabs={["surveillance"]}>
      {({ activeTab, setActiveTab }) => (
        <Tabs
          className="h-[85vh]"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="bg-background mb-0 pb-0">
            <TabsTrigger
              value="surveillance"
              className="border-primary bg-primary text-secondary data-[state=active]:bg-secondary data-[state=active]:text-primary hover:bg-secondary hover:text-primary mx-[2px]"
            >
              Surveillance
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="surveillance"
            className="mt-0 flex flex-1 flex-col overflow-hidden border-0 px-0 pt-[5px]"
          >
            <SurveillanceData onSelectionChange={setSelectedRows} />
          </TabsContent>
        </Tabs>
      )}
    </WithGenomePanel>
  );
}
