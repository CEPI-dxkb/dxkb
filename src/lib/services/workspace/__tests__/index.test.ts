vi.mock("@/lib/services/workspace/client", () => ({
  WorkspaceApiClient: vi.fn(),
  createWorkspaceApiClient: vi.fn(),
  workspaceApi: {},
}));
vi.mock("@/lib/services/workspace/methods/ls", () => ({
  WorkspaceLsMethods: vi.fn(),
}));
vi.mock("@/lib/services/workspace/methods/permissions", () => ({
  WorkspacePermissionsMethods: vi.fn(),
}));
vi.mock("@/lib/services/workspace/methods/crud", () => ({
  WorkspaceCrudMethods: vi.fn(),
}));
vi.mock("@/lib/services/workspace/validation", () => ({
  checkWorkspaceObjectExists: vi.fn(),
}));
vi.mock("@/lib/services/workspace/types", () => ({}));

import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import { WorkspaceLsMethods } from "@/lib/services/workspace/methods/ls";
import { WorkspacePermissionsMethods } from "@/lib/services/workspace/methods/permissions";
import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";
import { WorkspaceApi, createWorkspaceApi, workspace } from "../index";

describe("WorkspaceApi", () => {
  it("creates ls, permissions, and crud instances in constructor", () => {
    const api = new WorkspaceApi();
    expect(WorkspaceApiClient).toHaveBeenCalledTimes(1);
    expect(WorkspaceLsMethods).toHaveBeenCalledTimes(1);
    expect(WorkspacePermissionsMethods).toHaveBeenCalledTimes(1);
    expect(WorkspaceCrudMethods).toHaveBeenCalledTimes(1);
    expect(api.ls).toBeDefined();
    expect(api.permissions).toBeDefined();
    expect(api.crud).toBeDefined();
  });

  it("passes authToken to WorkspaceApiClient", () => {
    new WorkspaceApi("my-token");
    expect(WorkspaceApiClient).toHaveBeenCalledWith("my-token");
  });

  it("createWorkspaceApi factory returns a WorkspaceApi instance", () => {
    const api = createWorkspaceApi("token-123");
    expect(api).toBeInstanceOf(WorkspaceApi);
    expect(WorkspaceApiClient).toHaveBeenCalledWith("token-123");
  });

  it("default workspace export is a WorkspaceApi instance", () => {
    expect(workspace).toBeInstanceOf(WorkspaceApi);
  });

  it("createWorkspaceApi works without arguments", () => {
    const api = createWorkspaceApi();
    expect(api).toBeInstanceOf(WorkspaceApi);
    expect(WorkspaceApiClient).toHaveBeenCalledWith(undefined);
  });
});
