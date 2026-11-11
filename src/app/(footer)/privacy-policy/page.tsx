import FooterHeader from "@/components/headers/footer-header";
import { Separator } from "@/components/ui/separator";
import PrivacySidebar from "./components/privacy-sidebar";
import { privacyPolicySections } from "./data/privacy-policy-sections";

const PrivacyPolicy = () => {
  return (
    <div>
      <FooterHeader title="Privacy Policy" />

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 md:flex-row">
          <PrivacySidebar />

          <main className="max-w-3xl grow">
            <section id="introduction" className="mb-10">
              <div className="mb-6 border-l-4 border-secondary bg-secondary/20 p-4">
                <p className="text-secondary">
                  This Privacy Policy was last updated on <strong>July 22, 2026</strong>. Please read it carefully as it
                  affects your rights and how your data is handled.
                </p>
              </div>

              <p className="mb-6 text-lg text-muted-foreground">
                DXKB is provided as a public resource for the research community. This Privacy Policy describes the ways
                DXKB collects, stores, uses, discloses, and protects the personal information about users and how they
                use DXKB. DXKB never collects information for commercial marketing or any purpose unrelated to DXKB
                functions.
              </p>
            </section>

            {privacyPolicySections.map((section) => (
              <section id={section.title.toLowerCase().replace(/\s+/g, '-')} key={section.id}>
                <div className="mb-4 flex items-center">
                  <div className="mr-3 flex size-8 items-center justify-center rounded-full bg-secondary/20" key={section.id}>
                    <span className="font-bold text-secondary">{section.id}</span>
                  </div>
                  <h2 className="text-xl font-bold">{section.title}</h2>
                </div>

                <p className="mb-4">{section.description}</p>
              </section>
            ))}

            <Separator className="my-8" />

            <div className="flex items-center justify-end">
              <div className="text-sm text-foreground">© 2026 DXKB. All rights reserved.</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy