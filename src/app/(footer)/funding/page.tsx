"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import FooterHeader from "@/components/headers/footer-header";
import Logo from "@/components/ui/logo";

const Funding = () => {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, always use the default theme
  // This prevents hydration mismatch
  const currentTheme = mounted ? theme : "dxkb-light";
  const isDarkTheme = currentTheme?.includes("-dark");
  const logoVariant = isDarkTheme ? "sponsor-logo-white" : "sponsor-logo";

  return (
    <div id="funding-container">
      <FooterHeader title="Our Funding" />
      <div className="funding-section">
        <div
          id="funding-content"
          className="flex flex-col gap-8 text-sm md:text-lg"
        >
          <Logo variant={logoVariant} width={200} height={100} />
          <p>
            This project is supported by the Coalition for Epidemic Preparedness
            Innovations (CEPI) under the Disease X Program. We gratefully
            acknowledge CEPI&apos;s commitment to advancing global health security
            and its pivotal role in funding initiatives aimed at preventing and
            controlling infectious disease outbreaks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Funding;
