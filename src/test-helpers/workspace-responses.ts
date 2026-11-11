import { HttpResponse } from "msw";

/** `Workspace.get` answer for a missing path (JSON-RPC error inside HTTP 500), which `checkWorkspaceObjectExists` reads as "name available"; other 5xx is "could not check". */
export function workspaceObjectNotFound(): HttpResponse<{
  error: string;
  apiResponse: { code: number; message: string };
}> {
  return HttpResponse.json(
    {
      error: "BV-BRC API error: 500 Internal Server Error",
      apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
    },
    { status: 500 },
  );
}
