import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Search } from "lucide-react";

const HelpHero = () => {
  return (
    <section className="border-b bg-background">
    <div className="container mx-auto px-4 py-12 text-center md:py-16">
      {/* <h1 className="text-3xl md:text-4xl font-bold mb-4">How can we help you?</h1> */}
      <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
        Search our knowledge base for answers to common questions or browse help topics below.
      </p>
      <div className="relative mx-auto max-w-xl rounded-lg bg-white">
        <Input type="text" placeholder="Search for help topics..." className="bg-background py-6 pl-10 text-base" />
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 transform text-primary" size={18} />
        <Button className="absolute top-1/2 right-1 -translate-y-1/2 transform bg-secondary text-white hover:bg-accent hover:text-white">
          Search
        </Button>
      </div>
    </div>
  </section>
  )
}

export default HelpHero;