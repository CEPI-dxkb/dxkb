import { redirectSignedInUser } from "@/lib/auth/server/page-auth";
import { SigninView } from "./sign-in-view";

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  await redirectSignedInUser((await searchParams).redirect);
  return <SigninView />;
}
