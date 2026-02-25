import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";
import { WorkspacePanelProvider } from "@/contexts/workspace-panel-context";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <WorkspacePanelProvider>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </WorkspacePanelProvider>
      {/* <Footer /> */}
    </div>
  );
}
