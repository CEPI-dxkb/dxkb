import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FaGithub,
  FaTwitter,
  FaFacebook,
  FaInstagram,
  FaYoutube,
} from "react-icons/fa";
import { Button } from "@/components/buttons/button";

interface FooterLink {
  name: string;
  url: string;
}

interface FooterSection {
  title: string;
  titleUrl: string;
  links: FooterLink[];
}

const isExternalUrl = (url: string): boolean => {
  return url.startsWith("http") || url.startsWith("https");
};

const footerLinks: FooterSection[] = [
  {
    title: "ABOUT",
    titleUrl: "/about",
    links: [
      { name: "Funding", url: "/funding" },
      { name: "Our Team", url: "/team" },
      { name: "Community News", url: "/news" },
    ],
  },
  {
    title: "FAQ",
    titleUrl: "/faq",
    links: [
      { name: "Documentation", url: "https://docs.dxkb.org" },
      { name: "Related Resources", url: "/related-resources" },
      { name: "Tutorials", url: "https://docs.dxkb.org/bv-brc/resources" },
    ],
  },
  {
    title: "UPDATES",
    titleUrl: "/updates",
    links: [
      { name: "Calendar", url: "/calendar" },
      { name: "Publications", url: "/publications" },
      { name: "Citations", url: "/citations" },
    ],
  },
  {
    title: "HELP",
    titleUrl: "/help",
    links: [
      { name: "Contact Us", url: "/contact" },
      { name: "Instructional Videos", url: "https://docs.dxkb.org/bv-brc/resources" },
      { name: "Privacy Policy", url: "/privacy-policy" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="bg-primary-def rounded-t-xl py-8 text-white">
      <div className="mx-auto w-full px-12">
        <div className="grid gap-8 md:grid-cols-[25%_75%]">
          <div id="website-info" className="order-2 flex flex-col md:order-1">
            <Image
              src="/logos/dxkb-text-white.svg"
              alt="DXKB Logo"
              width={100}
              height={32}
              className="h-14 w-auto self-start"
              priority
            />
            <span className="mt-5 text-xl font-semibold">
              A CEPI Initiative.
            </span>
            <span className="mt-1 text-sm text-white/80">
              This project is funded in whole or in parts with Federal funds
              using grants awarded to the University of Chicago.
            </span>
            <div className="gap-auto mt-4 flex lg:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-secondary-500 h-8 w-8"
                asChild
              >
                <Link href="https://twitter.com" target="_blank">
                  <FaTwitter className="h-4 w-4" />
                  <span className="sr-only">Twitter</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-secondary-500 h-8 w-8"
                asChild
              >
                <Link href="https://facebook.com" target="_blank">
                  <FaFacebook className="h-4 w-4" />
                  <span className="sr-only">Facebook</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-secondary-500 h-8 w-8"
                asChild
              >
                <Link href="https://instagram.com" target="_blank">
                  <FaInstagram className="h-4 w-4" />
                  <span className="sr-only">Instagram</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-secondary-500 h-8 w-8"
                asChild
              >
                <Link href="https://github.com" target="_blank">
                  <FaGithub className="h-4 w-4" />
                  <span className="sr-only">GitHub</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-secondary-500 h-8 w-8"
                asChild
              >
                <Link href="https://youtube.com" target="_blank">
                  <FaYoutube className="h-4 w-4" />
                  <span className="sr-only">YouTube</span>
                </Link>
              </Button>
            </div>
          </div>
          <div
            id="footer-links"
            className="order-1 grid grid-cols-2 gap-4 md:order-2 md:grid-cols-4"
          >
            {footerLinks.map((section) => (
              <div key={section.title}>
                <h4 className="text-secondary-def mb-4 font-bold">
                  <Link
                    href={section.titleUrl}
                    className="hover:underline hover:text-secondary-500"
                    {...(isExternalUrl(section.titleUrl) && {
                      target: "_blank",
                    })}
                  >
                    {section.title}
                  </Link>
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.url}
                        className="hover:underline"
                        {...(isExternalUrl(link.url) && { target: "_blank" })}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
