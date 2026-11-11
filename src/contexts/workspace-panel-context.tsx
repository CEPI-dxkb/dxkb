"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface WorkspacePanelContextType {
  panelManuallyHidden: boolean;
  setPanelManuallyHidden: (value: boolean) => void;
  panelExpanded: boolean;
  setPanelExpanded: (value: boolean) => void;
}

const WorkspacePanelContext = createContext<
  WorkspacePanelContextType | undefined
>(undefined);

export function WorkspacePanelProvider({ children }: { children: ReactNode }) {
  const [panelManuallyHidden, setPanelManuallyHidden] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);

  const value: WorkspacePanelContextType = {
    panelManuallyHidden,
    setPanelManuallyHidden,
    panelExpanded,
    setPanelExpanded,
  };

  return (
    <WorkspacePanelContext.Provider value={value}>
      {children}
    </WorkspacePanelContext.Provider>
  );
}

export function useWorkspacePanel(): WorkspacePanelContextType {
  const ctx = useContext(WorkspacePanelContext);
  if (ctx === undefined) {
    throw new Error(
      "useWorkspacePanel must be used within WorkspacePanelProvider",
    );
  }
  return ctx;
}
