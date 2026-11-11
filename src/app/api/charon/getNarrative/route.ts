import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    { error: "narratives are not supported" },
    { status: 501 },
  );
}
