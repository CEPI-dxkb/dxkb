import { Button } from "@/components/buttons/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LuMenu } from "react-icons/lu";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RxAvatar } from "react-icons/rx"
import { cn } from "@/lib/utils"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import Link from "next/link";

const servicesNavigation = {
  genomics: {
    title: "Genomics",
    items: [
      { title: "Genome Assembly", href: "/services/genomics/genome-assembly" },
      { title: "Genome Annotation", href: "/services/genomics/genome-annotation" },
      { title: "BLAST", href: "/services/genomics/blast" },
      { title: "Primer Design", href: "/services/genomics/primer-design" },
      { title: "Similar Genome Finder", href: "/services/genomics/similar-genome-finder" },
      { title: "Genome Alignment", href: "/services/genomics/genome-alignment" },
      { title: "Variation Analysis", href: "/services/genomics/variation-analysis" },
    ],
  },
  phylogenomics: {
    title: "Phylogenomics",
    items: [
      { title: "Viral Genome Tree", href: "/services/phylogenomics/viral-genome-tree" },
      { title: "Gene/Protein Tree", href: "/services/phylogenomics/gene-protein-tree" },
    ],
  },
  proteinTools: {
    title: "Protein Tools",
    items: [
      { title: "MSA and SNP Analysis", href: "/services/protein-tools/msa-snp-analysis" },
      { title: "Meta-CATS", href: "/services/protein-tools/meta-cats" },
      { title: "Proteome Comparison", href: "/services/protein-tools/proteome-comparison" },
    ],
  },
  metagenomics: {
    title: "Metagenomics",
    items: [
      { title: "Taxonomic Classification", href: "/services/metagenomics/taxonomic-classification" },
      { title: "Metagenomic Binning", href: "/services/metagenomics/metagenomic-binning" },
      { title: "Metagenomic Read Mapping", href: "/services/metagenomics/metagenomic-read-mapping" },
    ],
  },
  utilities: {
    title: "Utilities",
    items: [
      { title: "Fastq Utilities", href: "/services/utilities/fastq-utilities" },
    ],
  },
  viralTools: {
    title: "Viral Tools",
    items: [
      { title: "SARS-CoV-2 Genome Analysis", href: "/services/viral-tools/sars-cov2-genome-analysis" },
      { title: "SARS-CoV-2 Wastewater Analysis", href: "/services/viral-tools/sars-cov2-wastewater-analysis" },
      { title: "Influenza HA Subtype Conversion", href: "/services/viral-tools/influenza-ha-subtype" },
      { title: "Subspecies Classification", href: "/services/viral-tools/subspecies-classification" },
      { title: "Viral Assembly", href: "/services/viral-tools/viral-assembly" },
    ],
  },
  outbreakTracker: {
    title: "BV-BRC Outbreak Tracker",
    items: [
      { title: "Mpox 2024", href: "/services/outbreak-tracker/mpox-2024" },
      { title: "Influenza H5N1 2024", href: "/services/outbreak-tracker/influenza-h5n1-2024" },
      { title: "SARS-CoV-2", href: "/services/outbreak-tracker/sars-cov2" },
    ],
  },
} as const;

const MobileNavbar = () => {
  return (
    <header className="md:hidden flex px-4 py-4 bg-primary-def text-white justify-between items-center">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild className="group hover:bg-gray-300/50">
            <Button variant="ghost">
              <LuMenu className="text-gray-300 scale-125 group-hover:text-white group-hover:scale-150 transition-all duration-300" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-md overflow-y-auto p-0">
            <div id="sheet-logo" className="flex p-3 bg-primary-def w-full">
              <Image
                src="/logos/dxkb-logo-white-cropped.svg"
                alt="DXKB Logo"
                width={100}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </div>

            <div className="flex flex-col divide-y divide-gray-100">
              {/* Getting Started Section */}
              <div className="p-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Getting Started</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Link href="/introduction" className="text-sm py-1 hover:text-primary-def">Introduction</Link>
                  <Link href="/installation" className="text-sm py-1 hover:text-primary-def">Installation</Link>
                  <Link href="https://docs.dxkb.org" className="text-sm py-1 hover:text-primary-def">Documentation</Link>
                </div>
              </div>

              {/* Organisms Section */}
              <div className="p-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Organisms</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <Link href="/organisms/viruses" className="text-sm py-1 hover:text-primary-def">Viruses</Link>
                  <Link href="/organisms/bacteria" className="text-sm py-1 hover:text-primary-def">Bacteria</Link>
                  <Link href="/organisms/fungi" className="text-sm py-1 hover:text-primary-def">Fungi</Link>
                  <Link href="/organisms/all" className="text-sm py-1 hover:text-primary-def">Browse All</Link>
                </div>
              </div>

              {/* Services Sections */}
              <div className="p-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Services</h2>
                <div className="grid grid-cols-1 gap-y-4">
                  {Object.entries(servicesNavigation).map(([key, section]) => (
                    <div key={key}>
                      <h3 className="text-[13px] font-medium bg-primary-def text-white px-2.5 py-1 rounded mb-1.5">
                        {section.title}
                      </h3>
                      <div className="grid grid-cols-1 gap-y-0.5 pl-2">
                        {section.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="text-sm py-0.5 hover:text-primary-def"
                          >
                            {item.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link id="dxkb-logo" href="/">
          <Image
            src="/logos/dxkb-logo-orange.svg"
            alt="DXKB Logo"
            width={100}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
      </div>

      <div className="flex">
        <Button variant="ghost" size="icon" className="group transition-all duration-300 h-10 w-10">
          <span className="sr-only">User account</span>
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              <RxAvatar className="h-6 w-6 text-gray-400 group-hover:text-black" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  )
}

export default MobileNavbar;