import { WorkspaceApiClient } from "@/lib/services/workspace/client";

/**
 * Workspace.get_download_url / Workspace.get_archive_url - Download URLs and archives
 */
export class WorkspaceDownloadMethods {
  constructor(private client: WorkspaceApiClient) {}

  /**
   * Get one-time download URLs for workspace objects.
   * Calls Workspace.get_download_url; returns array of URL arrays, one per requested path.
   */
  async getDownloadUrls(objectPaths: string[]): Promise<string[][]> {
    if (objectPaths.length === 0) return [];
    return this.client.makeRequest<string[][]>("Workspace.get_download_url", [
      { objects: objectPaths },
    ]);
  }

  /**
   * Get one-time URL for downloading multiple workspace objects as an archive.
   * Calls Workspace.get_archive_url; returns [url, file_count, total_size].
   */
  async getArchiveUrl(params: {
    objects: string[];
    recursive: boolean;
    archive_name: string;
    archive_type: string;
  }): Promise<[string, number, number]> {
    return this.client.makeRequest<[string, number, number]>(
      "Workspace.get_archive_url",
      [params],
    );
  }
}
