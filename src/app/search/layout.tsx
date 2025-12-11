import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";
import { Suspense } from "react";

export default function VirusesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex grow flex-col h-full">
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </main>
      <Footer />
    </div>
  );
}