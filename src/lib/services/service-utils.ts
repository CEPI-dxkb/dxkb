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
): Promise<{ success: boolean; job?: [SubmitJobEntry]; error?: string }> {
  try {
    const response = await fetch("/api/services/app-service/submit", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_name: appName,
        app_params: appParams,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        // Include additional error details if available
        if (errorData.details) {
          errorMessage += `: ${JSON.stringify(errorData.details)}`;
        }
      } catch {
        // If response is not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch {
          // Keep the default error message
        }
      }
      throw new Error(errorMessage);
    }

    const result = (await response.json()) as { job?: [SubmitJobEntry] };
    return { success: true, job: result.job };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to submit service job";
    return { success: false, error: errorMessage };
  }
}
