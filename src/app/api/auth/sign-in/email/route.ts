import { NextRequest } from "next/server";
import { authAdmin, respondWithSession } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  return respondWithSession(await authAdmin.signIn(await request.json()));
}
