import { apiCall } from "@/lib/api/client";
import { ApiCallError } from "@/lib/api/types";

/** Shape of a single job in the submit response (array of one element) */
export interface SubmitJobEntry {
  id: string;
  app?: string;
  status?: string;
  submit_time?: string;
}

/**
 * Generic service submission helper
 * Submits any service job via the workspace API
 */
export async function submitServiceJob(
  appName: string,
  appParams: Record<string, unknown>,
): Promise<{
  success: boolean;
  job?: [SubmitJobEntry];
  error?: string;
  details?: unknown;
  /** HTTP status of a failed submit; 504 means the job service never answered. */
  status?: number;
}> {
  try {
    const result = await apiCall<{ job?: [SubmitJobEntry] }>(
      "/api/services/app-service/submit",
      { app_name: appName, app_params: appParams },
    );
    return { success: true, job: result.job };
  } catch (error) {
    if (error instanceof ApiCallError) {
      return {
        success: false,
        error: error.message,
        details: error.details,
        status: error.status,
      };
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to submit service job";
    return { success: false, error: errorMessage };
  }
}
