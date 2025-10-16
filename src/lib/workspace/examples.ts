/**
 * Examples of how to use the modular Workspace API
 */

import { WorkspaceApi } from "./index";

// Create a workspace API instance
const workspace = new WorkspaceApi();

// Example 1: List all objects in a user's workspace
export async function listAllObjects(user: string) {
  try {
    const response = await workspace.ls.listObjects({
      paths: [`/${user}@bvbrc/home/`],
      excludeDirectories: false,
      excludeObjects: false,
      recursive: true,
    });

    console.log("All objects:", response);
    return response;
  } catch (error) {
    console.error("Failed to list objects:", error);
    throw error;
  }
}

// Example 2: Get only folders
export async function getFolders(user: string, path: string = "/home/") {
  try {
    const folders = await workspace.ls.getFolders(user, path);
    console.log("Folders:", folders);
    return folders;
  } catch (error) {
    console.error("Failed to get folders:", error);
    throw error;
  }
}

// Example 3: Search for specific files
export async function searchFiles(user: string, query: string) {
  try {
    const files = await workspace.ls.searchObjects(user, query, "/home/", [
      "file",
    ]);
    console.log("Search results:", files);
    return files;
  } catch (error) {
    console.error("Failed to search files:", error);
    throw error;
  }
}

// Example 4: Create a new folder
export async function createFolder(user: string, folderName: string) {
  try {
    const response = await workspace.crud.createFolder(
      `${user}@bvbrc`,
      `/home/${folderName}`,
      { created_by: user, created_at: new Date().toISOString() },
    );

    console.log("Created folder:", response);
    return response;
  } catch (error) {
    console.error("Failed to create folder:", error);
    throw error;
  }
}

// Example 5: Get permissions for an object
export async function getObjectPermissions(user: string, objectId: string) {
  try {
    const response = await workspace.permissions.getObjectPermissions(
      `${user}@bvbrc`,
      objectId,
    );

    console.log("Object permissions:", response);
    return response;
  } catch (error) {
    console.error("Failed to get permissions:", error);
    throw error;
  }
}

// Example 6: Copy an object
export async function copyObject(
  user: string,
  sourceId: string,
  destinationId: string,
) {
  try {
    const response = await workspace.crud.copyObject(
      `${user}@bvbrc`,
      sourceId,
      `${user}@bvbrc`,
      destinationId,
    );

    console.log("Copied object:", response);
    return response;
  } catch (error) {
    console.error("Failed to copy object:", error);
    throw error;
  }
}

// Example 7: Delete an object
export async function deleteObject(user: string, objectId: string) {
  try {
    const response = await workspace.crud.deleteObject(
      `${user}@bvbrc`,
      objectId,
    );

    console.log("Deleted object:", response);
    return response;
  } catch (error) {
    console.error("Failed to delete object:", error);
    throw error;
  }
}

// Example 8: Get object with metadata
export async function getObjectMetadata(user: string, objectId: string) {
  try {
    const response = await workspace.crud.getObjectMetadata(
      `${user}@bvbrc`,
      objectId,
    );

    console.log("Object metadata:", response);
    return response;
  } catch (error) {
    console.error("Failed to get object metadata:", error);
    throw error;
  }
}

// Example 9: Save a file with data
export async function saveFile(
  user: string,
  fileName: string,
  content: string,
) {
  try {
    const response = await workspace.crud.saveObject(
      `${user}@bvbrc`,
      `/home/${fileName}`,
      "file",
      {
        created_by: user,
        created_at: new Date().toISOString(),
        size: content.length,
      },
      btoa(content), // Base64 encode the content
    );

    console.log("Saved file:", response);
    return response;
  } catch (error) {
    console.error("Failed to save file:", error);
    throw error;
  }
}

// Example 10: Rename an object
export async function renameObject(
  user: string,
  objectId: string,
  newName: string,
) {
  try {
    const response = await workspace.crud.renameObject(
      `${user}@bvbrc`,
      objectId,
      newName,
    );

    console.log("Renamed object:", response);
    return response;
  } catch (error) {
    console.error("Failed to rename object:", error);
    throw error;
  }
}
