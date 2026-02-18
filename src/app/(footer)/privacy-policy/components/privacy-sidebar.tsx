import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { LuSearch } from "react-icons/lu";
import { privacyPolicySections } from "../data/privacy-policy-sections";

const PrivacySidebar = () => {
  return (
    <aside className="md:w-64 lg:w-72 shrink-0">
    <div className="sticky top-24">
      <div className="relative mb-6">
        <Input type="text" placeholder="Search policy..." className="pl-9" />
        <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary" size={16} />
      </div>

      <div className="mb-6">
        <Badge className="mb-2">Last Updated: April 8, 2023</Badge>
        <Progress value={0} className="mb-2">
          <ProgressLabel className="text-xs text-muted-foreground">
            Reading progress
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      </div>

      <div className="space-y-1 mb-6">
        <h3 className="font-medium text-sm mb-2">On This Page</h3>
        <nav className="space-y-1">
          {privacyPolicySections.map((section) => (
            <a
              key={section.id}
              href={`#${section.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="block px-3 py-2 text-sm rounded-md hover:bg-background"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-4 bg-secondary rounded-lg">
        <h3 className="font-medium text-sm mb-2 text-white">Need Help?</h3>
        <p className="text-sm text-white mb-4">
          If you have questions about our privacy practices, please contact our Data Protection Officer.
        </p>
        <Button size="sm" variant="outline" className="w-full bg-secondary hover:bg-accent text-white">
          Contact Us
        </Button>
      </div>
    </div>
  </aside>
  )
}

export default PrivacySidebar