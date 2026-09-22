import {
  BookOpen,
  Bug,
  ChevronDown,
  FlaskConical,
  FolderOpen,
} from "lucide-react";

import { MobileDecoratedSubSection } from "@/components/navbars/mobile-decorated-subsection";
import { MobileNavLink } from "@/components/navbars/mobile-nav-link";
import { MobileSubSectionTrigger } from "@/components/navbars/mobile-subsection-trigger";
import { MobileWorkspaceSection } from "@/components/navbars/mobile-workspace-section";
import {
  organismItems,
  resourcesItems,
  serviceItems,
  workspaceNavItems,
  type NavSection,
} from "@/components/navbars/navbar-links";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Logo from "@/components/ui/logo";
import type { RecentFolder } from "@/lib/recent-workspace-folders";

interface MobileSheetNavigationProps {
  favoritePaths: string[];
  isAuthenticated: boolean;
  recentFolders: RecentFolder[];
  wsUsername: string;
}

function SectionTrigger({
  icon: Icon,
  count,
  children,
}: {
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <CollapsibleTrigger className="group hover:bg-muted/40 data-open:bg-secondary/5 flex w-full items-center gap-3 px-4 py-3.5 transition-colors">
      <div className="bg-secondary/10 text-secondary group-hover:bg-secondary/20 group-data-open:bg-secondary/20 flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors">
        <Icon className="size-4" />
      </div>
      <span className="text-foreground flex-1 text-left text-sm font-semibold">
        {children}
      </span>
      {count != null && (
        <span className="bg-primary rounded-full px-2.5 py-0.5 text-xs font-bold text-white">
          {count}
        </span>
      )}
      <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open:rotate-180" />
    </CollapsibleTrigger>
  );
}

export function MobileSheetNavigation({
  favoritePaths,
  isAuthenticated,
  recentFolders,
  wsUsername,
}: MobileSheetNavigationProps) {
  const totalServiceItems = Object.values(serviceItems).reduce(
    (count, section) => count + section.items.length,
    0,
  );
  const totalWorkspaceItems =
    workspaceNavItems.workspaces.items.length +
    workspaceNavItems.data.items.length +
    favoritePaths.length +
    recentFolders.length;

  return (
    <>
      <div className="bg-primary relative p-4 pb-5">
        <div className="flex items-start gap-1">
          <Logo
            variant="logo-white"
            width={100}
            height={40}
            className="h-8 w-auto"
            priority
          />
          <span className="mt-0.5 text-[10px] font-semibold text-white/70">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
        <div className="from-primary absolute inset-x-0 bottom-0 h-3 bg-linear-to-b to-transparent" />
      </div>

      <nav className="flex flex-col pb-6">
        <Collapsible>
          <SectionTrigger icon={Bug} count={organismItems.length}>
            Organisms
          </SectionTrigger>
          <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
            <div className="flex flex-col px-5 pt-2 pb-3">
              {organismItems.map((item) => (
                <MobileNavLink key={item.href} href={item.href}>
                  {item.title}
                </MobileNavLink>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="bg-border mx-4 h-px" />

        <Collapsible>
          <SectionTrigger icon={FlaskConical} count={totalServiceItems}>
            Services
          </SectionTrigger>
          <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
            <div className="flex flex-col gap-1.5 px-5 pt-2 pb-3">
              {(
                Object.entries(serviceItems) as unknown as [
                  string,
                  NavSection,
                ][]
              ).map(([key, section]) => (
                <Collapsible key={key} className="group/sub">
                  <MobileDecoratedSubSection>
                    <MobileSubSectionTrigger>
                      {section.title}
                    </MobileSubSectionTrigger>
                    <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
                      <div className="flex flex-col pb-1">
                        {section.items.map((item) => (
                          <MobileNavLink
                            key={item.href}
                            href={item.href}
                            target={item.target}
                          >
                            {item.title}
                          </MobileNavLink>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </MobileDecoratedSubSection>
                </Collapsible>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="bg-border mx-4 h-px" />

        <Collapsible>
          <SectionTrigger icon={FolderOpen} count={totalWorkspaceItems}>
            Workspace
          </SectionTrigger>
          <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
            <MobileWorkspaceSection
              favoritePaths={favoritePaths}
              isAuthenticated={isAuthenticated}
              recentFolders={recentFolders}
              wsUsername={wsUsername}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="bg-border mx-4 h-px" />

        <Collapsible>
          <SectionTrigger icon={BookOpen} count={resourcesItems.length}>
            Resources
          </SectionTrigger>
          <CollapsibleContent className="*:data-[slot=collapsible-divider]:hidden">
            <div className="flex flex-col px-5 pt-2 pb-3">
              {resourcesItems.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={item.href}
                  target={item.target}
                >
                  {item.title}
                </MobileNavLink>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </nav>
    </>
  );
}
