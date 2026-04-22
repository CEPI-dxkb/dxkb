import { authAdmin, respondWithAck } from "@/lib/auth/server";

export async function POST() {
  return respondWithAck(await authAdmin.signOut());
}
