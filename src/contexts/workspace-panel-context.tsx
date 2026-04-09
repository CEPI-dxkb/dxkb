"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

/** Panel ids used by react-resizable-panels in the workspace layout. */
export const workspacePanelIds = { main: "workspace-main", details: "workspace-details" } as const;

/** Cookie name used to persist the panel layout for server rendering. */
export const panelLayoutCookieName = "workspace-panel-layout";

/** Layout from react-resizable-panels: panel id -> size (%). Persists across folder navigation. */
const defaultPanelLayout: Record<string, number> = {
  [workspacePanelIds.main]: 60,
  [workspacePanelIds.details]: 40,
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
  /** Stable snapshot of the initial panel layout — safe to read during render (e.g. for defaultSize props). */
  panelInitialLayout: Record<string, number>;
  /** Ref holding resizable panel layout (panel id -> %). Stored as a ref to avoid re-renders during resize drag. */
  panelLayoutRef: React.RefObject<Record<string, number>>;
  setPanelLayout: (layout: Record<string, number>) => void;
}

const WorkspacePanelContext = createContext<WorkspacePanelContextType | undefined>(undefined);

export function WorkspacePanelProvider({
  children,
  initialLayout,
}: {
  children: ReactNode;
  initialLayout?: Record<string, number>;
}) {
  const [panelManuallyHidden, setPanelManuallyHidden] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [panelInitialLayout] = useState(() => initialLayout ?? defaultPanelLayout);
  const panelLayoutRef = useRef<Record<string, number>>(panelInitialLayout);
  const setPanelLayout = useCallback((layout: Record<string, number>) => {
    panelLayoutRef.current = layout;
    // Persist to cookie so the server can render the correct layout on next page load
    document.cookie = `${panelLayoutCookieName}=${JSON.stringify(layout)};path=/workspace;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  }, []);

  const value = useMemo<WorkspacePanelContextType>(
    () => ({
      panelManuallyHidden,
      setPanelManuallyHidden,
      panelExpanded,
      setPanelExpanded,
      showHiddenFiles,
      setShowHiddenFiles,
      panelInitialLayout,
      panelLayoutRef,
      setPanelLayout,
    }),
    [
      panelManuallyHidden,
      setPanelManuallyHidden,
      panelExpanded,
      setPanelExpanded,
      showHiddenFiles,
      setShowHiddenFiles,
      panelInitialLayout,
      panelLayoutRef,
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
