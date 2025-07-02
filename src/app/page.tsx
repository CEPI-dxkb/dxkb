"use client";

import React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import WelcomeSearch from "@/components/search/welcome-search";
import Navbar from "@/components/navbars/navbar";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import ResearchUpdates from "@/components/research/research-updates";
import DBStatistics from "@/components/statistics/db-statistics";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { isAuthenticated, isVerified } = useAuth();

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Navbar />

      <main className="bg-background grow">
        <WelcomeSearch />
        <QuickViralLinks />
        <NewsCarousel />
        <DBStatistics />
        <ResearchUpdates />
      </main>

      <Footer />
    </div>
  );
}
