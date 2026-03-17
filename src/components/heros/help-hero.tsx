import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Search } from "lucide-react";

const HelpHero = () => {
  return (
    <section className="bg-background border-b">
    <div className="container mx-auto px-4 py-12 md:py-16 text-center">
      {/* <h1 className="text-3xl md:text-4xl font-bold mb-4">How can we help you?</h1> */}
      <p className="text-foreground-muted max-w-2xl mx-auto mb-8">
        Search our knowledge base for answers to common questions or browse help topics below.
      </p>
      <div className="max-w-xl mx-auto relative bg-white rounded-lg">
        <Input type="text" placeholder="Search for help topics..." className="pl-10 py-6 text-base bg-background" />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary" size={18} />
        <Button className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-secondary hover:bg-accent text-white hover:text-white">
          Search
        </Button>
      </div>
    </div>
  </section>
  )
}

export default HelpHero;