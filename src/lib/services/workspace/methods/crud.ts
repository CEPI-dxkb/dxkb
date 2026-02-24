import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import {
  WorkspaceCreateParams,
  WorkspaceCreateResponse,
  WorkspaceDeleteParams,
  WorkspaceDeleteResponse,
  WorkspaceCopyParams,
  WorkspaceCopyResponse,
  WorkspaceMoveParams,
  WorkspaceMoveResponse,
  WorkspaceRenameParams,
  WorkspaceRenameResponse,
  WorkspaceGetParams,
  WorkspaceGetResponse,
  WorkspaceSaveParams,
  WorkspaceSaveResponse,
} from "@/lib/services/workspace/types";

/**
 * Workspace CRUD operations - Create, Read, Update, Delete
 */
export class WorkspaceCrudMethods {
  constructor(private client: WorkspaceApiClient) {}

  /**
   * Workspace.create - Create new workspace objects
   */
  async create(
    params: WorkspaceCreateParams,
  ): Promise<WorkspaceCreateResponse> {
    return this.client.makeRequest<WorkspaceCreateResponse>(
      "Workspace.create",
      [params],
    );
  }

  /**
   * Create a single folder
   */
  async createFolder(
    workspace: string,
    id: string,
    meta?: Record<string, unknown>,
  ): Promise<WorkspaceCreateResponse> {
    return this.create({
      objects: [
        {
          workspace,
          id,
          type: "folder",
          meta,
        },
      ],
    });
  }

  /**
   * Create a single file
   */
  async createFile(
    workspace: string,
    id: string,
    meta?: Record<string, unknown>,
  ): Promise<WorkspaceCreateResponse> {
    return this.create({
      objects: [
        {
          workspace,
          id,
          type: "file",
          meta,
        },
      ],
    });
  }

  /**
   * Workspace.delete - Delete workspace objects
   */
  async delete(
    params: WorkspaceDeleteParams,
  ): Promise<WorkspaceDeleteResponse> {
    return this.client.makeRequest<WorkspaceDeleteResponse>(
      "Workspace.delete",
      [params],
    );
  }

  /**
   * Delete a single object by full path (e.g. /user@realm/home/file.pdb).
   */
  async deleteObject(path: string): Promise<WorkspaceDeleteResponse> {
    return this.delete({ objects: [path] });
  }

  /**
   * Delete multiple objects by full paths.
   */
  async deleteMultipleObjects(paths: string[]): Promise<WorkspaceDeleteResponse> {
    return this.delete({ objects: paths });
  }

  /**
   * Workspace.copy - Copy workspace objects
   */
  async copy(params: WorkspaceCopyParams): Promise<WorkspaceCopyResponse> {
    return this.client.makeRequest<WorkspaceCopyResponse>("Workspace.copy", [
      params,
    ]);
  }

  /**
   * Copy a single object
   */
  async copyObject(
    workspace: string,
    id: string,
    newWorkspace: string,
    newId: string,
  ): Promise<WorkspaceCopyResponse> {
    return this.copy({
      objects: [{ workspace, id }],
      new_workspace: newWorkspace,
      new_id: newId,
    });
  }

  /**
   * Workspace.move - Move workspace objects
   */
  async move(params: WorkspaceMoveParams): Promise<WorkspaceMoveResponse> {
    return this.client.makeRequest<WorkspaceMoveResponse>("Workspace.move", [
      params,
    ]);
  }

  /**
   * Move a single object
   */
  async moveObject(
    workspace: string,
    id: string,
    newWorkspace: string,
    newId: string,
  ): Promise<WorkspaceMoveResponse> {
    return this.move({
      objects: [{ workspace, id }],
      new_workspace: newWorkspace,
      new_id: newId,
    });
  }

  /**
   * Workspace.rename - Rename workspace objects
   */
  async rename(
    params: WorkspaceRenameParams,
  ): Promise<WorkspaceRenameResponse> {
    return this.client.makeRequest<WorkspaceRenameResponse>(
      "Workspace.rename",
      [params],
    );
  }

  /**
   * Rename a single object
   */
  async renameObject(
    workspace: string,
    id: string,
    newName: string,
  ): Promise<WorkspaceRenameResponse> {
    return this.rename({
      objects: [{ workspace, id }],
      new_name: newName,
    });
  }

  /**
   * Workspace.get - Get workspace objects with metadata and data
   */
  async get(params: WorkspaceGetParams): Promise<WorkspaceGetResponse> {
    return this.client.makeRequest<WorkspaceGetResponse>("Workspace.get", [
      params,
    ]);
  }

  /**
   * Get a single object with metadata only
   */
  async getObjectMetadata(
    workspace: string,
    id: string,
  ): Promise<WorkspaceGetResponse> {
    return this.get({
      objects: [{ workspace, id }],
      infos: [{ workspace, id, metadata_only: true }],
    });
  }

  /**
   * Get a single object with data
   */
  async getObjectWithData(
    workspace: string,
    id: string,
  ): Promise<WorkspaceGetResponse> {
    return this.get({
      objects: [{ workspace, id }],
      infos: [{ workspace, id, metadata_only: false }],
    });
  }

  /**
   * Workspace.save - Save workspace objects
   */
  async save(params: WorkspaceSaveParams): Promise<WorkspaceSaveResponse> {
    return this.client.makeRequest<WorkspaceSaveResponse>("Workspace.save", [
      params,
    ]);
  }

  /**
   * Save a single object
   */
  async saveObject(
    workspace: string,
    id: string,
    type: string,
    meta: Record<string, unknown>,
    data?: string,
  ): Promise<WorkspaceSaveResponse> {
    return this.save({
      objects: [
        {
          workspace,
          id,
          type,
          meta,
          data,
        },
      ],
    });
  }
}
