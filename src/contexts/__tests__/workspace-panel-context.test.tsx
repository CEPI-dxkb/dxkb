import { renderHook, act } from "@testing-library/react";
import React from "react";

import {
  WorkspacePanelProvider,
  useWorkspacePanel,
} from "../workspace-panel-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkspacePanelProvider>{children}</WorkspacePanelProvider>
);

describe("WorkspacePanelContext", () => {
  it("useWorkspacePanel throws outside provider", () => {
    expect(() => renderHook(() => useWorkspacePanel())).toThrow(
      "useWorkspacePanel must be used within WorkspacePanelProvider",
    );
  });

  it("provides default values", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    expect(result.current.panelManuallyHidden).toBe(false);
    expect(result.current.panelExpanded).toBe(false);
    expect(result.current.showHiddenFiles).toBe(false);
    expect(result.current.panelLayoutRef.current).toEqual(
      expect.objectContaining({
        "workspace-main": 60,
        "workspace-details": 40,
      }),
    );
  });

  it("setPanelExpanded updates state", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    act(() => {
      result.current.setPanelExpanded(true);
    });

    expect(result.current.panelExpanded).toBe(true);
  });

  it("setShowHiddenFiles updates state", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    act(() => {
      result.current.setShowHiddenFiles(true);
    });

    expect(result.current.showHiddenFiles).toBe(true);
  });

  it("setPanelManuallyHidden updates state", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    act(() => {
      result.current.setPanelManuallyHidden(true);
    });

    expect(result.current.panelManuallyHidden).toBe(true);
  });
});
