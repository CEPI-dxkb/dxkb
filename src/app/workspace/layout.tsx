import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex grow py-8 justify-center mx-4">
        <div className="workspace-container container">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
