import { NextRequest, NextResponse } from "next/server";
import { getServerAuthToken } from "../../../../../../lib/server-auth-utils";
import { createWorkspaceService } from "../../../../../../lib/workspace-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getServerAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceService = createWorkspaceService(token);
    const output = await workspaceService.fetchJobOutput({
      job_id: (await params).id,
      output_type: "stderr",
    });

    return new NextResponse(output, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error fetching stderr:", error);
    return NextResponse.json(
      { error: "Failed to fetch stderr" },
      { status: 500 },
    );
  }
}
