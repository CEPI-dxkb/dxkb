import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

export default async function HomeWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/workspace/home");
  return children;
}
