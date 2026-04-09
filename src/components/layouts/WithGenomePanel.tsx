"use client";

import { useState } from "react";
import { InfoPanel } from "@/components/detail-panel/info-panel";

interface WithGenomePanelProps {
  children: (props: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
  }) => React.ReactNode;
  tabs: string[];
  activeTab?: string;
  selectedRows: Record<string, unknown>[];
  setSelectedRows: (rows: Record<string, unknown>[]) => void;
}

export function WithGenomePanel({
  children,
  tabs,
  activeTab: incomingTab,
  selectedRows,
  setSelectedRows: _setSelectedRows,
}: WithGenomePanelProps) {
  const initialTab = incomingTab && tabs.includes(incomingTab) ? incomingTab : tabs[0];
  const [activeTab, setActiveTab] = useState(initialTab);

  const hasSelection = selectedRows.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[10px] mt-[10px]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`flex min-h-0 flex-col overflow-hidden ${hasSelection ? "w-[80%]" : "w-full"}`}>
          {children({ activeTab, setActiveTab })}
        </div>
        {hasSelection && (
          <div className="flex w-[20%] min-h-0 flex-col overflow-hidden bg-background text-foreground shadow-md">
            <InfoPanel rows={selectedRows} activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
}
