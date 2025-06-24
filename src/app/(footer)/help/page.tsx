import React from 'react'
import ContactUs from './components/contact-us'
import HelpHero from '@/components/heros/help-hero'
import HelpTopics from './components/help-topics'
import HelpFAQs from './components/help-faqs'
import FooterHeader from '@/components/headers/footer-header'
const Help = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <FooterHeader title="How can we help you?" />

      {/* Help Intro/Search Section */}
      <HelpHero />

      {/* Help Categories */}
      <HelpTopics />

      {/* FAQ Section */}
      <HelpFAQs />

      {/* Contact Support */}
      <ContactUs />
    </div>
  )
}

export default Help