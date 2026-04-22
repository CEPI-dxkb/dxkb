import { authAdmin, respondWithSession } from "@/lib/auth/server";

export async function POST() {
  return respondWithSession(await authAdmin.exitImpersonation());
}
