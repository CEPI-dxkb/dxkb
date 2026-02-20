"use client";

import { useState } from "react";
import { InfoPanel } from "../containers/InfoPanel";

type WithGenomePanelProps = {
  children: (props: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
  }) => React.ReactNode;
  tabs: string[];
  activeTab?: string;
  selectedRows: any[]; // new
  setSelectedRows: (rows: any[]) => void; // new
};

export function WithGenomePanel({
  children,
  tabs,
  activeTab: incomingTab,
  selectedRows,
  setSelectedRows,
}: WithGenomePanelProps) {
  const initialTab = incomingTab && tabs.includes(incomingTab) ? incomingTab : tabs[0];
  const [activeTab, setActiveTab] = useState(initialTab);

  const hasSelection = selectedRows.length > 0;

  return (
    <div className="w-full px-[10px] mt-[10px]">
      <div className="flex w-full h-full">
        <div className={hasSelection ? "w-[80%]" : "w-full"}>
          {children({ activeTab, setActiveTab })}
        </div>
        {hasSelection && (
          <div className="w-[20%] h-[85vh] overflow-auto p-2 bg-background text-foreground shadow-md">
            <InfoPanel rows={selectedRows} activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
}
