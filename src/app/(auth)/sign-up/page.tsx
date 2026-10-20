import { redirectSignedInUser } from "@/lib/auth/server/page-auth";
import { SignupView } from "./sign-up-view";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  await redirectSignedInUser((await searchParams).redirect);
  return <SignupView />;
}
