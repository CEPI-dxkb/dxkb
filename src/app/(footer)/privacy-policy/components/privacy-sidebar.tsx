import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { privacyPolicySections } from "@/app/(footer)/privacy-policy/data/privacy-policy-sections";

const PrivacySidebar = () => {
  return (
    <aside className="shrink-0 md:w-64 lg:w-72">
    <div className="sticky top-24">
      <div className="mb-6">
        <Badge>Last Updated: July 22, 2026</Badge>
      </div>

      <div className="mb-6 space-y-1">
        <h3 className="mb-2 text-sm font-medium">On This Page</h3>
        <nav className="space-y-1">
          {privacyPolicySections.map((section) => (
            <a
              key={section.id}
              href={`#${section.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="block rounded-md px-3 py-2 text-sm hover:bg-background"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </div>

      <div className="rounded-lg bg-secondary p-4">
        <h3 className="mb-2 text-sm font-medium text-white">Need Help?</h3>
        <p className="mb-4 text-sm text-white">
          If you have questions about our privacy practices, please contact us at help@dxkb.org.
        </p>
        <Button
          size="sm"
          variant="cta"
          nativeButton={false}
          className="w-full"
          render={<Link href="/contact" />}
        >
          Contact Us
        </Button>
      </div>
    </div>
  </aside>
  )
}

export default PrivacySidebar
