import { authAdmin } from "@/lib/auth/server/instance";
import { respondWithAck } from "@/lib/auth/server/respond";

export async function POST() {
  return respondWithAck(await authAdmin.signOut());
}
