import { WorkspacePanelProvider } from "@/contexts/workspace-panel-context";
import { WorkspaceDialogProvider } from "@/contexts/workspace-dialog-context";
import Navbar from "@/components/navbars/navbar";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";

/**
 * Layouts do not re-render on client-side navigation, so folder pages repeat
 * this check for folder-to-folder moves.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCurrentUserOrRedirect("/workspace");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <WorkspacePanelProvider>
        <WorkspaceDialogProvider>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </WorkspaceDialogProvider>
      </WorkspacePanelProvider>
    </div>
  );
}
