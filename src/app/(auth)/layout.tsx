import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="grow flex py-8">
          <div className="auth-container">
            {children}
          </div>
        </main>
        <Footer />
      </div>
  );
};