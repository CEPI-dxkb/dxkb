import { renderHook, act } from "@testing-library/react";
import React from "react";

vi.mock("@/types/workspace-browser", () => ({}));

import {
  WorkspaceDialogProvider,
  useWorkspaceDialog,
} from "../workspace-dialog-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspaceDialogProvider>{children}</WorkspaceDialogProvider>
);

describe("WorkspaceDialogContext", () => {
  it("useWorkspaceDialog throws outside provider", () => {
    expect(() => renderHook(() => useWorkspaceDialog())).toThrow(
      "useWorkspaceDialog must be used within WorkspaceDialogProvider",
    );
  });

  it("initial state has activeDialog: null", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    expect(result.current.state.activeDialog).toBeNull();
  });

  it("OPEN_CREATE_FOLDER sets correct dialog type", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "OPEN_CREATE_FOLDER" });
    });

    expect(result.current.state.activeDialog).toEqual({ type: "createFolder" });
  });

  it("OPEN_UPLOAD sets correct dialog type", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "OPEN_UPLOAD" });
    });

    expect(result.current.state.activeDialog).toEqual({ type: "upload" });
  });

  it("OPEN_DELETE sets items and empty nonEmptyPaths", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    const items = [
      { name: "file.txt", path: "/test/file.txt" },
    ] as unknown as import("@/types/workspace-browser").WorkspaceBrowserItem[];

    act(() => {
      result.current.dispatch({ type: "OPEN_DELETE", items });
    });

    expect(result.current.state.activeDialog).toEqual(
      expect.objectContaining({
        type: "delete",
        items,
        nonEmptyPaths: [],
      }),
    );
  });

  it("CLOSE resets to null", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "OPEN_CREATE_FOLDER" });
    });

    expect(result.current.state.activeDialog).not.toBeNull();

    act(() => {
      result.current.dispatch({ type: "CLOSE" });
    });

    expect(result.current.state.activeDialog).toBeNull();
  });

  it("SET_DELETE_NON_EMPTY_PATHS updates paths when delete dialog is active", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    const items = [
      { name: "folder", path: "/test/folder" },
    ] as unknown as import("@/types/workspace-browser").WorkspaceBrowserItem[];

    act(() => {
      result.current.dispatch({ type: "OPEN_DELETE", items });
    });

    act(() => {
      result.current.dispatch({
        type: "SET_DELETE_NON_EMPTY_PATHS",
        paths: ["/test/folder"],
      });
    });

    expect(result.current.state.activeDialog).toEqual(
      expect.objectContaining({
        type: "delete",
        items,
        nonEmptyPaths: ["/test/folder"],
      }),
    );
  });

  it("SET_DELETE_NON_EMPTY_PATHS is no-op when no delete dialog", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "OPEN_UPLOAD" });
    });

    const stateBefore = result.current.state;

    act(() => {
      result.current.dispatch({
        type: "SET_DELETE_NON_EMPTY_PATHS",
        paths: ["/test/folder"],
      });
    });

    expect(result.current.state).toEqual(stateBefore);
  });

  it("OPEN_DOWNLOAD_OPTIONS sets paths and defaultName", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "OPEN_DOWNLOAD_OPTIONS",
        paths: ["/test/a.txt", "/test/b.txt"],
        defaultName: "archive",
      });
    });

    expect(result.current.state.activeDialog).toEqual({
      type: "downloadOptions",
      paths: ["/test/a.txt", "/test/b.txt"],
      defaultName: "archive",
    });
  });

  it("OPEN_CREATE_WORKSPACE sets createWorkspace type", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    act(() => {
      result.current.dispatch({ type: "OPEN_CREATE_WORKSPACE" });
    });

    expect(result.current.state.activeDialog).toEqual({ type: "createWorkspace" });
  });

  it("OPEN_COPY with move mode sets copy dialog with move mode", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    const items = [
      { name: "file.txt", path: "/test/file.txt" },
    ] as unknown as import("@/types/workspace-browser").WorkspaceBrowserItem[];

    act(() => {
      result.current.dispatch({ type: "OPEN_COPY", items, mode: "move" });
    });

    expect(result.current.state.activeDialog).toEqual(
      expect.objectContaining({
        type: "copy",
        items,
        mode: "move",
      }),
    );
  });

  it("OPEN_EDIT_TYPE sets editType dialog with item", () => {
    const { result } = renderHook(() => useWorkspaceDialog(), { wrapper });

    const item = { name: "file.txt", path: "/test/file.txt" } as unknown as import("@/types/workspace-browser").WorkspaceBrowserItem;

    act(() => {
      result.current.dispatch({ type: "OPEN_EDIT_TYPE", item });
    });

    expect(result.current.state.activeDialog).toEqual(
      expect.objectContaining({
        type: "editType",
        item,
      }),
    );
  });
});
