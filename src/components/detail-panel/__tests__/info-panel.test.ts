import { getItemFullPath } from "../info-panel";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

function makeItem(
  overrides: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem {
  return {
    id: "id-1",
    path: "/user/home/test",
    name: "test",
    type: "contigs",
    creation_time: "2024-01-01T00:00:00Z",
    link_reference: "",
    owner_id: "user@test.com",
    size: 100,
    userMeta: {},
    autoMeta: {},
    user_permission: "o",
    global_permission: "r",
    timestamp: Date.parse("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("getItemFullPath", () => {
  it("builds full path from parent path and name", () => {
    const item = makeItem({ path: "/user/home", name: "myfile.txt" });
    expect(getItemFullPath(item)).toBe("/user/home/myfile.txt");
  });

  it("does not duplicate name when path already contains it", () => {
    const item = makeItem({ path: "/user/home/myfile.txt", name: "myfile.txt" });
    expect(getItemFullPath(item)).toBe("/user/home/myfile.txt");
  });

  it("normalizes multiple consecutive slashes", () => {
    const item = makeItem({ path: "/user//home///", name: "file.txt" });
    expect(getItemFullPath(item)).toBe("/user/home/file.txt");
  });

  it("strips trailing slashes from path", () => {
    const item = makeItem({ path: "/user/home/", name: "data.fasta" });
    expect(getItemFullPath(item)).toBe("/user/home/data.fasta");
  });

  it("handles path that equals name", () => {
    const item = makeItem({ path: "myfolder", name: "myfolder" });
    expect(getItemFullPath(item)).toBe("/myfolder");
  });

  it("handles missing path (uses name alone)", () => {
    const item = makeItem({ path: "", name: "file.txt" });
    expect(getItemFullPath(item)).toBe("/file.txt");
  });

  it("handles missing name", () => {
    const item = makeItem({ path: "/user/home", name: "" });
    // Empty name results in trailing slash (path + "/" + "")
    expect(getItemFullPath(item)).toBe("/user/home/");
  });

  it("handles both path and name missing", () => {
    const item = makeItem({ path: "", name: "" });
    expect(getItemFullPath(item)).toBe("");
  });

  it("adds leading slash when missing", () => {
    const item = makeItem({ path: "user/home", name: "file.txt" });
    expect(getItemFullPath(item)).toBe("/user/home/file.txt");
  });

  it("handles whitespace-only name", () => {
    const item = makeItem({ path: "/user/home", name: "   " });
    // Whitespace trims to empty, produces trailing slash
    expect(getItemFullPath(item)).toBe("/user/home/");
  });

  it("handles null-ish path gracefully", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = makeItem({ path: null as any, name: "file.txt" });
    expect(getItemFullPath(item)).toBe("/file.txt");
  });

  it("handles null-ish name gracefully", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = makeItem({ path: "/user/home", name: null as any });
    // null coerces to "" via fallback, produces trailing slash
    expect(getItemFullPath(item)).toBe("/user/home/");
  });
});
