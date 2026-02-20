"use client";

import { useState } from "react";
import { InfoPanel } from "../containers/InfoPanel";

type WithGenomePanelProps = {
  children: (props: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
  }) => React.ReactNode;
  tabs: string[];
  selectedRows: any[];
};

export function WithGenomePanel({
  children,
  tabs,
  selectedRows,
}: WithGenomePanelProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const hasSelection = selectedRows.length > 0;

  console.log("WithGenomePanel render", selectedRows);

  return (
    <div className="flex">
      <div className={hasSelection ? "w-[80%]" : "w-full"}>
        {children({ activeTab, setActiveTab })}
      </div>

      {hasSelection && (
        <div className="w-[20%]">
          <InfoPanel rows={selectedRows} activeTab={activeTab} />
        </div>
      )}
    </div>
  );
}
