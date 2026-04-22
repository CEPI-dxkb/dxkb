import { NextRequest } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithSession } from "@/lib/auth/server/respond";

export async function POST(request: NextRequest) {
  return respondWithSession(await authAdmin.signUp(await request.json()));
}
