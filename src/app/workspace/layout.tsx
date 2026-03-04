import { WorkspacePanelProvider } from "@/contexts/workspace-panel-context";
import { WorkspaceDialogProvider } from "@/contexts/workspace-dialog-context";
import Navbar from "@/components/navbars/navbar";
// import Footer from "@/components/footers/footer";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <WorkspacePanelProvider>
        <WorkspaceDialogProvider>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
        </WorkspaceDialogProvider>
      </WorkspacePanelProvider>
      {/* <Footer /> */}
    </div>
  );
}
