import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { addRecentFolder } from "@/lib/recent-workspace-folders";
import { jsdomLocalStorage } from "@/test-helpers/storage";
import { useRecentWorkspaceFolders } from "../use-recent-workspace-folders";

const stored = JSON.stringify([
  { path: "/alice@bvbrc/home/Experiments", visitedAt: 2 },
  { path: "/bob@bvbrc/home/Theirs", visitedAt: 1 },
]);

function FolderCount() {
  const folders = useRecentWorkspaceFolders("alice@bvbrc");
  return <span>{folders.length}</span>;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", jsdomLocalStorage());
  localStorage.clear();
  localStorage.setItem("dxkb-recent-workspace-folders:v1", stored);
});

describe("useRecentWorkspaceFolders", () => {
  it("renders no folders on the server, so hydration cannot mismatch", () => {
    expect(renderToString(<FolderCount />)).toBe("<span>0</span>");
  });

  it("returns only the user's folders on the client", () => {
    const { result } = renderHook(() =>
      useRecentWorkspaceFolders("alice@bvbrc"),
    );
    expect(result.current.map((folder) => folder.path)).toStrictEqual([
      "/alice@bvbrc/home/Experiments",
    ]);
  });

  it("updates when a folder is visited in this tab", () => {
    const { result } = renderHook(() =>
      useRecentWorkspaceFolders("alice@bvbrc"),
    );
    act(() => {
      addRecentFolder("/alice@bvbrc/home/New", "alice@bvbrc");
    });
    expect(result.current[0].path).toBe("/alice@bvbrc/home/New");
  });

  it("is empty when signed out", () => {
    const { result } = renderHook(() => useRecentWorkspaceFolders(undefined));
    expect(result.current).toStrictEqual([]);
  });
});
