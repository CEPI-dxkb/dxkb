"use client";

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type ReactNode,
  type Dispatch,
} from "react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

export type ActiveDialog =
  | { type: "delete"; items: WorkspaceBrowserItem[]; nonEmptyPaths: string[] }
  | { type: "copy"; items: WorkspaceBrowserItem[]; mode: "copy" | "move" }
  | { type: "editType"; item: WorkspaceBrowserItem }
  | { type: "createFolder" }
  | { type: "createWorkspace" }
  | { type: "upload" }
  | { type: "downloadOptions"; paths: string[]; defaultName: string }
  | { type: "fileViewerConstruction" }
  | null;

export interface WorkspaceDialogState {
  activeDialog: ActiveDialog;
  isLoading: boolean;
}

export type WorkspaceDialogAction =
  | { type: "OPEN_DELETE"; items: WorkspaceBrowserItem[] }
  | { type: "SET_DELETE_NON_EMPTY_PATHS"; paths: string[] }
  | { type: "OPEN_COPY"; items: WorkspaceBrowserItem[]; mode: "copy" | "move" }
  | { type: "OPEN_EDIT_TYPE"; item: WorkspaceBrowserItem }
  | { type: "OPEN_CREATE_FOLDER" }
  | { type: "OPEN_CREATE_WORKSPACE" }
  | { type: "OPEN_UPLOAD" }
  | { type: "OPEN_DOWNLOAD_OPTIONS"; paths: string[]; defaultName: string }
  | { type: "OPEN_FILE_VIEWER_CONSTRUCTION" }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "CLOSE" };

const initialState: WorkspaceDialogState = {
  activeDialog: null,
  isLoading: false,
};

function dialogReducer(
  state: WorkspaceDialogState,
  action: WorkspaceDialogAction,
): WorkspaceDialogState {
  switch (action.type) {
    case "OPEN_DELETE":
      return { activeDialog: { type: "delete", items: action.items, nonEmptyPaths: [] }, isLoading: false };
    case "SET_DELETE_NON_EMPTY_PATHS":
      if (state.activeDialog?.type !== "delete") return state;
      return { ...state, activeDialog: { ...state.activeDialog, nonEmptyPaths: action.paths } };
    case "OPEN_COPY":
      return { activeDialog: { type: "copy", items: action.items, mode: action.mode }, isLoading: false };
    case "OPEN_EDIT_TYPE":
      return { activeDialog: { type: "editType", item: action.item }, isLoading: false };
    case "OPEN_CREATE_FOLDER":
      return { activeDialog: { type: "createFolder" }, isLoading: false };
    case "OPEN_CREATE_WORKSPACE":
      return { activeDialog: { type: "createWorkspace" }, isLoading: false };
    case "OPEN_UPLOAD":
      return { activeDialog: { type: "upload" }, isLoading: false };
    case "OPEN_DOWNLOAD_OPTIONS":
      return { activeDialog: { type: "downloadOptions", paths: action.paths, defaultName: action.defaultName }, isLoading: false };
    case "OPEN_FILE_VIEWER_CONSTRUCTION":
      return { activeDialog: { type: "fileViewerConstruction" }, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.value };
    case "CLOSE":
      return initialState;
    default:
      return state;
  }
}

interface WorkspaceDialogContextType {
  state: WorkspaceDialogState;
  dispatch: Dispatch<WorkspaceDialogAction>;
}

const WorkspaceDialogContext = createContext<WorkspaceDialogContextType | undefined>(undefined);

export function WorkspaceDialogProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dialogReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <WorkspaceDialogContext.Provider value={value}>
      {children}
    </WorkspaceDialogContext.Provider>
  );
}

export function useWorkspaceDialog(): WorkspaceDialogContextType {
  const ctx = useContext(WorkspaceDialogContext);
  if (ctx === undefined) {
    throw new Error("useWorkspaceDialog must be used within WorkspaceDialogProvider");
  }
  return ctx;
}
