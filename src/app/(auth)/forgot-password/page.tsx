import { redirectSignedInUser } from "@/lib/auth/server/page-auth";
import { ForgotPasswordView } from "./forgot-password-view";

export default async function ForgotPasswordPage() {
  await redirectSignedInUser(undefined);
  return <ForgotPasswordView />;
}
