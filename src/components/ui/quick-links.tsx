import { Card } from "@/components/ui/card";
import Link from "next/link";

const links: Record<string, string[]> = {
  viruses: [
    "Bunyavirales",
    "Coronaviridae",
    "Filoviridae",
    "Influenza",
    "Orthomyxoviridae",
    "Paramyxoviridae",
    "All Viruses",
  ],
  analyze: [
    "Assembly",
    "Annotation",
    "BLAST",
    "FastQ Utilities",
    "MSA Analysis",
    "Similar Genome Finder",
    "All Utilities",
  ],
  resources: [
    "Quick Start",
    "Documentation",
    "Downloads",
    "Overview",
    "Reference Guides",
    "Tutorials",
    "All Resources",
  ],
};

const QuickLinks = () => {
  return (
    <section className="py-8 px-4">
      <h3 className="text-2xl font-bold text-center mb-6">Quick Links</h3>
      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h4 className="font-bold mb-4">Viruses</h4>
          <ul className="space-y-2">
            {links.viruses.map((link) => (
              <li key={link}>
                <Link
                  href={link === "All Viruses" ? "/viruses" : "#"}
                  className="text-primary hover:underline"
                >
                  {link}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h4 className="font-bold mb-4">Analyze</h4>
          <ul className="space-y-2">
            {links.analyze.map((link) => (
              <li key={link}>
                <Link href="#" className="text-primary hover:underline">
                  {link}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h4 className="font-bold mb-4">Resources</h4>
          <ul className="space-y-2">
            {links.resources.map((link) => (
              <li key={link}>
                <Link href="#" className="text-primary hover:underline">
                  {link}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  )
}

export default QuickLinks;