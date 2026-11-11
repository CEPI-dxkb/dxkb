import ContactUs from "./components/contact-us";
import HelpHero from "@/components/heros/help-hero";
import HelpTopics from "./components/help-topics";
import HelpFAQs from "./components/help-faqs";
import FooterHeader from "@/components/headers/footer-header";
const Help = () => {
  return (
    <div className="min-h-screen bg-background">
      <FooterHeader title="How can we help you?" />

      <HelpHero />

      <HelpTopics />

      <HelpFAQs />

      <ContactUs />
    </div>
  )
}

export default Help