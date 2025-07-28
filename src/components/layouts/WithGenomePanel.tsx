"use client";

import { useState } from "react";
import { useSelection } from "@/app/search/(searchtypes)/SelectionContext";
import { InfoPanel } from "../containers/InfoPanel";

export function WithGenomePanel({ children, tabs }: {
  children: (props: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
  }) => React.ReactNode;
  tabs: string[];
}) {
  const [activeTab, setActiveTabState] = useState(tabs[0]);
  const { selectedRows, setSelectedRows } = useSelection();
  const hasSelection = selectedRows.length > 0;

  const setActiveTab = (tab: string) => {
    setSelectedRows([]); // ❌ Clear selection on tab change
    setActiveTabState(tab);
  };

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
