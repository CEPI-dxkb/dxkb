import React from "react";
import FooterHeader from "@/components/headers/footer-header";
import Image from "next/image";

const Funding = () => {
  return (
    <div id="funding-container">
      <FooterHeader title="Our Funding" />
      <div className="funding-section">
        <div
          id="funding-content"
          className="flex flex-col gap-8 text-sm md:text-lg"
        >
          <Image
            src="/logos/cepi-logo.png"
            alt="CEPI Logo"
            width={200}
            height={100}
          />
          <p>
            This project is supported by the Coalition for Epidemic Preparedness
            Innovations (CEPI) under the Disease X Program. We gratefully
            acknowledge CEPI’s commitment to advancing global health security
            and its pivotal role in funding initiatives aimed at preventing and
            controlling infectious disease outbreaks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Funding;
