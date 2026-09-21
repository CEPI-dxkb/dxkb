import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function SharedWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/workspace/shared");
  return children;
}
