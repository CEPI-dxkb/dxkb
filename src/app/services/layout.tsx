"use client";

import Navbar from "@/components/navbars/navbar";
import Footer from "@/components/footers/footer";
import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { DebuggingPanel } from "@/components/services/debugging-panel";

interface ServiceLayoutProps {
  children: React.ReactNode;
}

export default function ServicesLayout({
  children,
}: ServiceLayoutProps) {
  return (
    <ServiceDebuggingProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="grow flex py-8">
          <div className="service-container container">
            {children}
          </div>
        </main>
        <Footer />
        <DebuggingPanel />
      </div>
    </ServiceDebuggingProvider>
  );
}