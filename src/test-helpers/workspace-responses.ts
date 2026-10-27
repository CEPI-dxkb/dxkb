import { HttpResponse } from "msw";

/**
 * `/api/services/workspace`'s answer to `Workspace.get` of a path that does
 * not exist, for MSW handlers. The Workspace reports a missing object as a
 * JSON-RPC error inside an HTTP 500, and the proxy forwards its message as
 * `apiResponse`. `checkWorkspaceObjectExists` reads this as "name available";
 * any other 5xx (an outage, an empty 500) is "could not check".
 */
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
