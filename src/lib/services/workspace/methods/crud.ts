import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import {
  WorkspaceCreateParams,
  WorkspaceCreateResponse,
  WorkspaceCreateUploadNodeResult,
  WorkspaceDeleteParams,
  WorkspaceDeleteResponse,
  WorkspaceCopyParams,
  WorkspaceCopyResponse,
  WorkspaceCopyByPathsParams,
  WorkspaceCopyByPathsResponse,
  WorkspaceMoveParams,
  WorkspaceMoveResponse,
  WorkspaceRenameParams,
  WorkspaceRenameResponse,
  WorkspaceGetParams,
  WorkspaceGetResponse,
  WorkspaceSaveParams,
  WorkspaceSaveResponse,
  WorkspaceUpdateMetadataParams,
  WorkspaceUpdateAutoMetaParams,
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
   * Create a single folder by full path (path-based Workspace.create).
   * Path format: /username@realm/home/.../folderName (e.g. /chrescobar@bvbrc/home/Testing/newfolder).
   */
  async createFolderByPath(fullPath: string): Promise<WorkspaceCreateResponse> {
    return this.client.makeRequest<WorkspaceCreateResponse>("Workspace.create", [
      { objects: [[fullPath, "Directory"]] },
    ]);
  }

  /**
   * Create an upload node for a file (Workspace.create with createUploadNodes: true).
   * Returns the Shock URL to PUT the file to. Directory path should be full path with trailing slash.
   */
  async createUploadNode(
    directoryPath: string,
    filename: string,
    type: string,
  ): Promise<WorkspaceCreateUploadNodeResult> {
    const dir = directoryPath.endsWith("/") ? directoryPath : directoryPath + "/";
    const fullPath = dir + filename;
    const result = await this.client.makeRequest<unknown[][]>("Workspace.create", [
      {
        objects: [[fullPath, type, {}, ""]],
        createUploadNodes: true,
      },
    ]);
    const tuple = result?.[0]?.[0] as unknown[] | undefined;
    const linkReference = tuple?.[11];
    if (typeof linkReference !== "string") {
      throw new Error("Workspace.create did not return a Shock URL (link_reference)");
    }
    return { link_reference: linkReference };
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
   * Copy by path pairs (BV-BRC API: objects as [sourcePath, destPath][]).
   */
  async copyByPaths(
    params: WorkspaceCopyByPathsParams,
  ): Promise<WorkspaceCopyByPathsResponse> {
    return this.client.makeRequest<WorkspaceCopyByPathsResponse>(
      "Workspace.copy",
      [params],
    );
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
   * Workspace.update_metadata - Update object type (and optional metadata)
   */
  async updateMetadata(
    params: WorkspaceUpdateMetadataParams,
  ): Promise<unknown[][]> {
    return this.client.makeRequest<unknown[][]>(
      "Workspace.update_metadata",
      [params],
    );
  }

  /**
   * Update the type of a single object by path
   */
  async updateObjectType(path: string, newType: string): Promise<unknown[][]> {
    return this.updateMetadata({
      objects: [[path, {}, newType]],
    });
  }

  /**
   * Workspace.update_auto_meta - Trigger auto metadata inspection for object(s) by path.
   * Call after uploading a file to Shock so the workspace updates size/type etc.
   */
  async updateAutoMetadata(paths: string[]): Promise<unknown[][]> {
    const params: WorkspaceUpdateAutoMetaParams = {
      objects: paths,
    };
    return this.client.makeRequest<unknown[][]>(
      "Workspace.update_auto_meta",
      [params],
    );
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
