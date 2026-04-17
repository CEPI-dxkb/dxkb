import {
  invalidateWorkspace,
  workspaceQueryKeys,
} from "@/lib/services/workspace/workspace-query-keys";

describe("workspaceQueryKeys", () => {
  it("every factory returns a tuple starting with the common root", () => {
    const root = workspaceQueryKeys.all;
    expect(root).toEqual(["workspace"]);
    for (const key of [
      workspaceQueryKeys.browser("user", "home", ""),
      workspaceQueryKeys.listPath("/a/b"),
      workspaceQueryKeys.sharedRoot("user"),
      workspaceQueryKeys.userRoot("user"),
      workspaceQueryKeys.publicRoot(),
      workspaceQueryKeys.publicUser("alice"),
      workspaceQueryKeys.publicPath("/p"),
      workspaceQueryKeys.metadata(["/a"]),
      workspaceQueryKeys.permissions(["/a"]),
      workspaceQueryKeys.pathResolve("/a"),
      workspaceQueryKeys.jobResult("/a/.job"),
      workspaceQueryKeys.du("/a"),
      workspaceQueryKeys.favorites("/a"),
      workspaceQueryKeys.miniBrowser("/a"),
      workspaceQueryKeys.search("user", "/home/", "reads"),
    ]) {
      expect(key[0]).toBe("workspace");
    }
  });

  it("invalidateWorkspace broadcasts to the root key", () => {
    const client = { invalidateQueries: vi.fn() };
    invalidateWorkspace(client);
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: workspaceQueryKeys.all,
    });
  });
});
