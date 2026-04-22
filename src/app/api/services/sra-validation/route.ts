import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";
import { withErrorHandling } from "@/lib/auth/server";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const accession = searchParams.get("accession");

  if (!accession) {
    return NextResponse.json(
      { error: "accession parameter is required" },
      { status: 400 },
    );
  }

  if (!accession.match(/^[a-z]{3}[0-9]+$/i)) {
    return NextResponse.json(
      { error: "Invalid accession format. Expected format: 3 letters followed by numbers (e.g., SRR123456)" },
      { status: 400 },
    );
  }

  const url = `${getRequiredEnv("SRA_VALIDATION_URL")}?retmax=10&db=sra&id=${accession}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/xml" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        return NextResponse.json(
          { error: `Accession ${accession} is not valid` },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: `NCBI API error: ${response.status} ${response.statusText}` },
        { status: response.status },
      );
    }

    const xmlText = await response.text();
    return NextResponse.json({ success: true, xml: xmlText });
  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      return NextResponse.json({ success: true, timeout: true, accession });
    }
    throw fetchError;
  }
});
