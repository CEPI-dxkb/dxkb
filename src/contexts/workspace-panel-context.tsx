"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface WorkspacePanelContextType {
  /** When true, user has manually hidden the details panel; don't auto-open on item selection or when traversing folders. */
  panelManuallyHidden: boolean;
  setPanelManuallyHidden: (value: boolean) => void;
  /** When true, the details panel is expanded (persists across folder navigation). */
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
