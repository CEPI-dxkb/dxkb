import React from "react";
import SearchBar from "@/components/search-bars/search-bar";
import ThemeContent from "@/components/ui/theme-content";

const WelcomeHero = () => {
  return (
    <section className="text-center py-16">
      <h1 className="text-4xl font-bold mb-4">Welcome to the</h1>
      <h2 className="text-3xl font-bold mb-8">
        <ThemeContent type="site-name" as="span" />
      </h2>
      <SearchBar />
    </section>
  )
}

export default WelcomeHero;