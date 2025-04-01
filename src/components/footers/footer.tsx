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

const footerLinks = {
  about: {
    Funding: "/funding",
    "Our Team": "/team",
    "Community News": "/news",
  },
  faq: {
    Documentation: "/documentation",
    "Related Resources": "/related-resources",
    Tutorials: "/tutorials",
  },
  updates: {
    Calendar: "/calendar",
    Publications: "/publications",
    Citations: "/citations",
  },
  help: {
    "Contact Us": "/contact",
    "Instructional Videos": "/instructional-videos",
    "Privacy Policy": "/privacy-policy",
  },
};

const footer = () => {
  return (
    <footer className="bg-dxkb-blue rounded-t-xl py-8 text-white">
      <div className="mx-auto w-full px-12">
        <div className="grid gap-8 md:grid-cols-[25%_75%]">
          <div id="website-info" className="flex flex-col order-2 md:order-1">
            <Image
              src="/dxkb-text-white.svg"
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
            <div className="mt-4 flex gap-auto lg:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="hover:text-dxkb-orange h-8 w-8"
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
                className="hover:text-dxkb-orange h-8 w-8"
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
                className="hover:text-dxkb-orange h-8 w-8"
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
                className="hover:text-dxkb-orange h-8 w-8"
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
                className="hover:text-dxkb-orange h-8 w-8"
                asChild
              >
                <Link href="https://youtube.com" target="_blank">
                  <FaYoutube className="h-4 w-4" />
                  <span className="sr-only">YouTube</span>
                </Link>
              </Button>
            </div>
          </div>
          <div id="footer-links" className="grid grid-cols-2 md:grid-cols-4 gap-4 order-1 md:order-2">
            <div>
              <h4 className="text-dxkb-orange mb-4 font-bold">
                <Link href="/about" className="hover:underline">
                  ABOUT
                </Link>
              </h4>
              <ul className="space-y-2">
                {Object.entries(footerLinks.about).map(
                  ([link_name, link_url]) => (
                    <li key={link_name}>
                      <Link href={link_url} className="hover:underline">
                        {link_name}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-dxkb-orange mb-4 font-bold">
                <Link href="/faq" className="hover:underline">
                  FAQ
                </Link>
              </h4>
              <ul className="space-y-2">
                {Object.entries(footerLinks.faq).map(([link_name, link_url]) => (
                  <li key={link_name}>
                    <Link href={link_url} className="hover:underline">
                      {link_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-dxkb-orange mb-4 font-bold">
                <Link href="/updates" className="hover:underline">
                  UPDATES
                </Link>
              </h4>
              <ul className="space-y-2">
                {Object.entries(footerLinks.updates).map(
                  ([link_name, link_url]) => (
                    <li key={link_name}>
                      <Link href={link_url} className="hover:underline">
                        {link_name}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <h4 className="text-dxkb-orange mb-4 font-bold">
                <Link href="/help" className="hover:underline">
                  HELP
                </Link>
              </h4>
              <ul className="space-y-2">
                {Object.entries(footerLinks.help).map(([link_name, link_url]) => (
                  <li key={link_name}>
                    <Link href={link_url} className="hover:underline">
                      {link_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default footer;
