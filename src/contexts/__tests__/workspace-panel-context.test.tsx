import { renderHook, act } from "@testing-library/react";
import React from "react";

import {
  WorkspacePanelProvider,
  useWorkspacePanel,
  panelLayoutCookieName,
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

  it("accepts initialLayout prop", () => {
    const customLayout = { "workspace-main": 50, "workspace-details": 50 };
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspacePanelProvider initialLayout={customLayout}>
        {children}
      </WorkspacePanelProvider>
    );

    const { result } = renderHook(() => useWorkspacePanel(), {
      wrapper: customWrapper,
    });

    expect(result.current.panelLayoutRef.current).toEqual(customLayout);
  });

  it("setPanelLayout updates the ref", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    const newLayout = { "workspace-main": 70, "workspace-details": 30 };
    act(() => {
      result.current.setPanelLayout(newLayout);
    });

    expect(result.current.panelLayoutRef.current).toEqual(newLayout);
  });

  it("exports panelLayoutCookieName constant", () => {
    expect(panelLayoutCookieName).toBe("workspace-panel-layout");
  });

  it("setPanelLayout persists layout to cookie", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    const newLayout = { "workspace-main": 70, "workspace-details": 30 };
    act(() => {
      result.current.setPanelLayout(newLayout);
    });

    expect(cookieSpy).toHaveBeenCalled();
    const cookieValue = cookieSpy.mock.calls[0][0];
    expect(cookieValue).toContain(panelLayoutCookieName);
    expect(cookieValue).toContain(JSON.stringify(newLayout));
    cookieSpy.mockRestore();
  });

  it("panelInitialLayout uses default when no initialLayout prop", () => {
    const { result } = renderHook(() => useWorkspacePanel(), { wrapper });

    expect(result.current.panelInitialLayout).toEqual({
      "workspace-main": 60,
      "workspace-details": 40,
    });
  });

  it("panelInitialLayout uses custom initialLayout prop", () => {
    const customLayout = { "workspace-main": 80, "workspace-details": 20 };
    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspacePanelProvider initialLayout={customLayout}>
        {children}
      </WorkspacePanelProvider>
    );

    const { result } = renderHook(() => useWorkspacePanel(), {
      wrapper: customWrapper,
    });

    expect(result.current.panelInitialLayout).toEqual(customLayout);
  });
});
