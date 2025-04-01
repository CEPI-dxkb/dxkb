import React from 'react'
import FooterHeader from '@/components/headers/footer-header'
import Footer from '@/components/footers/footer';
const Funding = () => {
  return (
    <div>
      <FooterHeader title="Our Funding" />
      <div id="funding-content" className="funding-content">
        <div id="funding-text" className="flex flex-col gap-4">
          <p>
            This project is supported by the Coalition for Epidemic Preparedness Innovations (CEPI) under the Disease X Program.
            We gratefully acknowledge CEPI’s commitment to advancing global health security and its pivotal role in funding initiatives
            aimed at preventing and controlling infectious disease outbreaks.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Funding