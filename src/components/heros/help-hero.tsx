import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

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
        <InputGroup className="h-12.5">
          <InputGroupInput type="text" placeholder="Search for help topics..." />
          <InputGroupAddon align="inline-start">
            <Search className="size-4.5 text-primary" />
          </InputGroupAddon>
        </InputGroup>
        <Button variant="cta" className="absolute top-1/2 right-1 -translate-y-1/2 transform">
          Search
        </Button>
      </div>
    </div>
  </section>
  )
}

export default HelpHero;