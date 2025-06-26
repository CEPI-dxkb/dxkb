"use client";

import React, { useEffect, useState } from "react";

import Footer from "@/components/footers/footer";
import NewsCarousel from "@/components/ui/news-carousel";
import WelcomeSearch from "@/components/search/welcome-search";
import Navbar from "@/components/navbars/navbar";
import QuickViralLinks from "@/components/quick-links/quick-viral";
import ResearchUpdates from "@/components/research/research-updates";
import DBStatistics from "@/components/statistics/db-statistics";
import { AuthProvider } from "@/contexts/AuthContext";

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const authUser = localStorage.getItem("brc_auth_user");
    if (authUser) {
      try {
        const userData = JSON.parse(authUser);
        setUsername(userData.username || userData.name || "User");
      } catch (error) {
        console.error("Error parsing auth user from localStorage:", error);
      }
    }
  }, []);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <Navbar />

      <main className="bg-background grow">
        {username && (
          <div className="container mx-auto px-4 py-2">
            <p className="text-muted-foreground text-sm">
              Welcome back, <span className="font-medium">{username}</span>
            </p>
          </div>
        )}

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
