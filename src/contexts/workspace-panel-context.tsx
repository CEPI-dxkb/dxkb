"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/** Panel ids used by react-resizable-panels in the workspace layout. */
export const WORKSPACE_PANEL_IDS = { main: "workspace-main", details: "workspace-details" } as const;

/** Layout from react-resizable-panels: panel id -> size (%). Persists across folder navigation. */
const DEFAULT_PANEL_LAYOUT: Record<string, number> = {
  [WORKSPACE_PANEL_IDS.main]: 75,
  [WORKSPACE_PANEL_IDS.details]: 25,
};

interface WorkspacePanelContextType {
  /** When true, user has manually hidden the details panel; don't auto-open on item selection or when traversing folders. */
  panelManuallyHidden: boolean;
  setPanelManuallyHidden: (value: boolean) => void;
  /** When true, the details panel is expanded (persists across folder navigation). */
  panelExpanded: boolean;
  setPanelExpanded: (value: boolean) => void;
  /** When true, show files/folders whose name starts with "." (persists across folder navigation). */
  showHiddenFiles: boolean;
  setShowHiddenFiles: (value: boolean) => void;
  /** Resizable panel layout (panel id -> %). Persists when user resizes (e.g. across folder navigation). */
  panelLayout: Record<string, number>;
  setPanelLayout: (layout: Record<string, number>) => void;
}

const WorkspacePanelContext = createContext<WorkspacePanelContextType | undefined>(undefined);

export function WorkspacePanelProvider({ children }: { children: ReactNode }) {
  const [panelManuallyHidden, setPanelManuallyHiddenState] = useState(false);
  const [panelExpanded, setPanelExpandedState] = useState(false);
  const [showHiddenFiles, setShowHiddenFilesState] = useState(false);
  const [panelLayout, setPanelLayoutState] = useState<Record<string, number>>(DEFAULT_PANEL_LAYOUT);
  const setPanelManuallyHidden = useCallback((value: boolean) => {
    setPanelManuallyHiddenState(value);
  }, []);
  const setPanelExpanded = useCallback((value: boolean) => {
    setPanelExpandedState(value);
  }, []);
  const setShowHiddenFiles = useCallback((value: boolean) => {
    setShowHiddenFilesState(value);
  }, []);
  const setPanelLayout = useCallback((layout: Record<string, number>) => {
    setPanelLayoutState(layout);
  }, []);

  const value = useMemo<WorkspacePanelContextType>(
    () => ({
      panelManuallyHidden,
      setPanelManuallyHidden,
      panelExpanded,
      setPanelExpanded,
      showHiddenFiles,
      setShowHiddenFiles,
      panelLayout,
      setPanelLayout,
    }),
    [
      panelManuallyHidden,
      setPanelManuallyHidden,
      panelExpanded,
      setPanelExpanded,
      showHiddenFiles,
      setShowHiddenFiles,
      panelLayout,
      setPanelLayout,
    ]
  );

  return (
    <WorkspacePanelContext.Provider value={value}>
      {children}
    </WorkspacePanelContext.Provider>
  );
}

export function useWorkspacePanel(): WorkspacePanelContextType {
  const ctx = useContext(WorkspacePanelContext);
  if (ctx === undefined) {
    throw new Error("useWorkspacePanel must be used within WorkspacePanelProvider");
  }
  return ctx;
}
