"use client";

import React, { useState } from "react";

import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import WelcomeSearch from "@/components/search/welcome-search";
import Navbar from "@/components/navbars/navbar";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import ResearchUpdates from "@/components/research/research-updates";
import DBStatistics from "@/components/statistics/db-statistics";
import { ThemeSwitcher } from "@/components/ui/theme-switcher-floating";

export default function Home() {
  const [searchResults, setSearchResults] = useState([]);

  return (
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar />

        <main className="grow bg-background">
          {/* <WelcomeHero /> */}
          {/* <QuickLinks /> */}
          <WelcomeSearch />
          <QuickViralLinks />
          <NewsCarousel />
          <DBStatistics />
          <ResearchUpdates />
          <ThemeSwitcher />
        </main>

        <Footer />
      </div>

  );
}