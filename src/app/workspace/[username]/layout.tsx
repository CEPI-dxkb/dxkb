import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function UserWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/workspace");
  return children;
}
