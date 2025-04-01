import React from "react";
import Image from "next/image";
import FooterHeader from "@/components/headers/footer-header";

const About = () => {
  return (
    <div id="about-container">
      <FooterHeader title="About DXKB" />
      <div className="about-section">
        <div id="about-text" className="flex flex-col gap-4 text-sm md:text-lg">
          <p>
            The Disease X Knowledge Base (DXKB) is an information system designed
            to support the discovery and development of immunogens for vaccine
            design, focusing on viral pathogens that may cause outbreaks of human
            disease. The DXKB contains curated data, custom visualizations,
            services, and artificial intelligence-based models intended to
            accelerate vaccine development.
          </p>
          <p>
            The DXKB is hosted by researchers at the University of Chicago
            Consortium for Advanced Science and Engineering (CASE). The resource
            is freely available to the public.
          </p>
        </div>

        <Image
          src="/workshop.jpg"
          alt="BV-BRC Workshop 2024 participants"
          className="rounded-xl w-full max-w-[600px] justify-self-center"
          quality={100}
          width={600}
          height={400}
        />
      </div>
    </div>
  );
};

export default About;
