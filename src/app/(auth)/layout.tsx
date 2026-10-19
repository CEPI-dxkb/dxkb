import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

// Each page sends a signed-in user away itself (`redirectSignedInUser`), because
// only a page receives `searchParams` and can honour `?redirect=`.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar />
      <main className="flex grow py-8">
        <div className="auth-container">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
