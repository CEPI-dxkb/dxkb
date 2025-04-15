"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/buttons/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RxAvatar } from "react-icons/rx";
import { cn } from "@/lib/utils";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const organisms: { title: string; href: string; description: string }[] = [
  {
    title: "Viruses",
    href: "/organisms/viruses",
    description: "Webpage for all viruses.",
  },
  {
    title: "Bacteria",
    href: "/organisms/bacteria",
    description: "Webpage for all bacteria.",
  },
  {
    title: "Fungi",
    href: "/organisms/fungi",
    description: "Webpage for all fungi.",
  },
  {
    title: "Browse All",
    href: "/organisms/all",
    description: "Webpage for all organisms.",
  },
];

const servicesNavigation = {
  genomics: {
    title: "Genomics",
    items: [
      {
        title: "BLAST",
        href: "/services/blast",
      },
      {
        title: "Genome Alignment",
        href: "/services/genome-alignment",
      },
      {
        title: "Genome Assembly",
        href: "/services/genome-assembly",
      },
      {
        title: "Genome Annotation",
        href: "/services/genome-annotation",
      },
      {
        title: "Primer Design",
        href: "/services/primer-design",
      },
      {
        title: "Similar Genome Finder",
        href: "/services/similar-genome-finder",
      },
      {
        title: "Variation Analysis",
        href: "/services/variation-analysis",
      },
    ],
  },
  phylogenomics: {
    title: "Phylogenomics",
    items: [
      {
        title: "Viral Genome Tree",
        href: "/services/viral-genome-tree",
      },
      {
        title: "Gene/Protein Tree",
        href: "/services/gene-protein-tree",
      },
    ],
  },
  proteinTools: {
    title: "Protein Tools",
    items: [
      {
        title: "MSA and SNP Analysis",
        href: "/services/msa-snp-analysis",
      },
      {
        title: "Meta-CATS",
        href: "/services/meta-cats",
      },
      {
        title: "Proteome Comparison",
        href: "/services/proteome-comparison",
      },
    ],
  },
  metagenomics: {
    title: "Metagenomics",
    items: [
      {
        title: "Taxonomic Classification",
        href: "/services/taxonomic-classification",
      },
      {
        title: "Metagenomic Binning",
        href: "/services/metagenomic-binning",
      },
      {
        title: "Metagenomic Read Mapping",
        href: "/services/metagenomic-read-mapping",
      },
    ],
  },
  utilities: {
    title: "Utilities",
    items: [
      {
        title: "Fastq Utilities",
        href: "/services/fastq-utilities",
      },
    ],
  },
  viralTools: {
    title: "Viral Tools",
    items: [
      {
        title: "SARS-CoV-2 Genome Analysis",
        href: "/services/sars-cov2-genome-analysis",
      },
      {
        title: "SARS-CoV-2 Wastewater Analysis",
        href: "/services/sars-cov2-wastewater-analysis",
      },
      {
        title: "Influenza HA Subtype Conversion",
        href: "/services/influenza-ha-subtype",
      },
      {
        title: "Subspecies Classification",
        href: "/services/subspecies-classification",
      },
      { title: "Viral Assembly", href: "/services/viral-assembly" },
    ],
  },
  outbreakTracker: {
    title: "BV-BRC Outbreak Tracker",
    items: [
      {
        title: "Mpox 2024",
        href: "/services/mpox-2024",
      },
      {
        title: "Influenza H5N1 2024",
        href: "/services/influenza-h5n1-2024",
      },
      {
        title: "SARS-CoV-2",
        href: "/services/sars-cov2",
      },
    ],
  },
} as const;

const DesktopNavbar = () => {
  return (
    <header className="bg-primary-def hidden items-center justify-between px-8 py-4 text-white md:flex">
      <div className="flex items-center space-x-4">
        <Link id="dxkb-logo" href="/">
          <Image
            src="/logos/dxkb-logo-white-cropped.svg"
            alt="DXKB Logo"
            width={100}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>

        <NavigationMenu className="bg-primary-def hidden w-full items-center justify-between font-bold md:flex">
          <NavigationMenuList>
            <NavigationMenuItem id="getting-started-nav">
              <NavigationMenuTrigger className="bg-primary-def">
                Getting started
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="from-muted/50 bg-primary-def hover:bg-primary-def/80 flex h-full w-full flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline transition-all duration-300 outline-none select-none focus:shadow-md"
                        href="/"
                      >
                        <Image
                          src="/logos/dxkb-logo-white-cropped.svg"
                          alt="DXKB Logo"
                          width={100}
                          height={40}
                        />
                        <div className="mt-4 mb-2 text-lg font-medium text-white">
                          shadcn/ui
                        </div>
                        <p className="text-sm leading-tight text-white">
                          Beautifully designed components that you can copy and
                          paste into your apps. Accessible. Customizable. Open
                          Source.
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <ListItem href="/docs" title="Introduction">
                    Re-usable components built using Radix UI and Tailwind CSS.
                  </ListItem>
                  <ListItem href="/docs/installation" title="Installation">
                    How to install dependencies and structure your app.
                  </ListItem>
                  <ListItem href="https://docs.dxkb.org" title="Documentation">
                    Documentation for DXKB and its related tools/services.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem id="organisms-nav">
              <NavigationMenuTrigger className="bg-primary-def">
                Organisms
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                  {organisms.map((organism) => (
                    <ListItem
                      key={organism.title}
                      title={organism.title}
                      href={organism.href}
                    >
                      {organism.description}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem id="services-nav">
              <NavigationMenuTrigger className="bg-primary-def">
                Services
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-[650px] grid-cols-2 gap-2 p-2">
                  <div className="space-y-0">
                    {/* Left Column */}
                    {Object.entries(servicesNavigation)
                      .slice(
                        0,
                        Math.ceil(Object.keys(servicesNavigation).length / 2),
                      )
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary-def my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                href={item.href}
                                className="hover:bg-secondary-100 my-0.5 block p-2 font-medium"
                              >
                                {item.title}
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                  <div className="space-y-0">
                    {/* Right Column */}
                    {Object.entries(servicesNavigation)
                      .slice(
                        Math.ceil(Object.keys(servicesNavigation).length / 2),
                      )
                      .map(([key, section]) => (
                        <div key={key}>
                          <h4 className="bg-primary-def my-0.5 rounded-md p-2 text-sm font-bold text-white">
                            {section.title}
                          </h4>
                          <div className="space-y-0">
                            {section.items.map((item) => (
                              <NavigationMenuLink
                                key={item.href}
                                href={item.href}
                                className="hover:bg-secondary-100 my-0.5 block p-2 font-medium"
                              >
                                {item.title}
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="group h-10 w-10 transition-all duration-300"
      >
        <span className="sr-only">User account</span>
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <RxAvatar className="h-6 w-6 text-gray-400 group-hover:text-black" />
          </AvatarFallback>
        </Avatar>
      </Button>
    </header>
  );
};

const ListItem = React.forwardRef<
  React.ComponentRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none",
            className,
          )}
          {...props}
        >
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export default DesktopNavbar;
