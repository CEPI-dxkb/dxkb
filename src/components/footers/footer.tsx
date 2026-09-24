import Link from "next/link";
import {
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import Logo from "@/components/ui/logo";
import ThemeContent from "@/components/ui/theme-content";

/** Ghost icon button styles for server component (avoids importing client-only buttonVariants). */
const socialLinkClassName =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 icon-link";

const socialIcons = {
  X: FaXTwitter,
  Facebook: FaFacebook,
  Instagram: FaInstagram,
  GitHub: FaGithub,
  YouTube: FaYoutube,
} as const;

interface SocialIconProps {
  name: keyof typeof socialIcons;
}

function SocialIcon({ name }: SocialIconProps) {
  const Icon = socialIcons[name];
  return <Icon aria-hidden className="size-4" data-icon="inline-start" />;
}

interface FooterLink {
  name: string;
  url: string;
}

interface FooterSection {
  title: string;
  /** When omitted, the section title renders as plain text (no link). */
  titleUrl?: string;
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
    ],
  },
  {
    title: "UPDATES",
    links: [
      { name: "Citations", url: "/citations" },
      { name: "Community News", url: "/news" },
      { name: "Publications", url: "/publications" },
    ],
  },
  {
    title: "FAQ",
    titleUrl: "/faq",
    links: [
      { name: "Documentation", url: "https://docs.dxkb.org" },
      { name: "Related Resources", url: "/related-resources" },
    ],
  },
  {
    title: "HELP",
    titleUrl: "/help",
    links: [
      { name: "Contact Us", url: "/contact" },
      { name: "Privacy Policy", url: "/privacy-policy" },
      {
        name: "Walkthroughs",
        url: "https://docs.dxkb.org/docs/bv-brc/resources",
      },
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
            <div className="mt-4 flex lg:gap-4">
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SocialIcon name="X" />
                <span className="sr-only">X</span>
              </Link>
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SocialIcon name="Facebook" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SocialIcon name="Instagram" />
                <span className="sr-only">Instagram</span>
              </Link>
              <Link
                href="https://github.com/CEPI-dxkb"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SocialIcon name="GitHub" />
                <span className="sr-only">GitHub</span>
              </Link>
              <Link
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialLinkClassName}
              >
                <SocialIcon name="YouTube" />
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
                  {section.titleUrl ? (
                    <Link
                      href={section.titleUrl}
                      {...(isExternalUrl(section.titleUrl) && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                    >
                      {section.title}
                    </Link>
                  ) : (
                    section.title
                  )}
                </h4>
                <ul className="mb-2 space-y-4 md:space-y-6">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.url}
                        className="footer-link"
                        {...(isExternalUrl(link.url) && {
                          target: "_blank",
                          rel: "noopener noreferrer",
                        })}
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
