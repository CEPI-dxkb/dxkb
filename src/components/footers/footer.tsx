import Link from "next/link";
import { SiGithub, SiFacebook, SiInstagram, SiYoutube, SiX } from "@icons-pack/react-simple-icons";
import Logo from "@/components/ui/logo";
import ThemeContent from "@/components/ui/theme-content";

/** Ghost icon button styles for server component (avoids importing client-only buttonVariants). */
const socialLinkClassName =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 icon-link";

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
      { name: "Source Code", url: "https://github.com/CEPI-dxkb" },
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
      { name: "Citations", url: "/citations" },
      { name: "Community News", url: "/news" },
      { name: "Publications", url: "/publications" },
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
    <footer className="bg-primary py-8 text-white">
      <div className="mx-auto w-full px-12">
        <div className="grid gap-8 md:grid-cols-[40%_60%]">
          <div id="website-info" className="order-2 flex flex-col md:order-1">
            <Logo
              variant="logo-text-white"
              alt="DXKB Logo"
              width={100}
              height={32}
              className="h-14 w-auto self-start"
              priority
            />
            <span className="mt-5 text-xl font-semibold">
              <ThemeContent type="funding-title" as="span" />
            </span>
            <span className="mt-1 text-sm text-white/80">
              <ThemeContent type="funding-statement" as="span" />
            </span>
            <div className="gap-auto mt-4 flex lg:gap-4">
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SiX className="h-4 w-4" data-icon="inline-start" />
                <span className="sr-only">X</span>
              </Link>
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SiFacebook className="h-4 w-4" data-icon="inline-start" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SiInstagram className="h-4 w-4" data-icon="inline-start" />
                <span className="sr-only">Instagram</span>
              </Link>
              <Link
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SiGithub className="h-4 w-4" data-icon="inline-start" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SiYoutube className="h-4 w-4" data-icon="inline-start" />
                <span className="sr-only">YouTube</span>
              </Link>
            </div>
          </div>
          <div
            id="footer-links"
            className="order-1 grid grid-cols-2 gap-4 md:order-2 md:grid-cols-4"
          >
            {footerLinks.map((section) => (
              <div key={section.title}>
                <h4 className="footer-header">
                  <Link
                    href={section.titleUrl}
                    {...(isExternalUrl(section.titleUrl) && {
                      target: "_blank",
                    })}
                  >
                    {section.title}
                  </Link>
                </h4>
                <ul className="space-y-4 md:space-y-6 mb-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.url}
                        className="footer-link"
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
