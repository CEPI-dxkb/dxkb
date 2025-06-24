import { Button } from "@/components/buttons/button";
import { LuMenu } from "react-icons/lu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RxAvatar } from "react-icons/rx";
import {
  gettingStartedItems,
  organismItems,
  serviceItems,
} from "./navbar-links";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import Logo from "@/components/ui/logo";

const MobileNavbar = () => {
  return (
    <header className="bg-primary flex items-center justify-between px-4 py-4 text-foreground md:hidden">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild className="group hover:bg-gray-300/50">
            <Button variant="ghost">
              <LuMenu className="scale-125 text-foreground transition-all duration-300 group-hover:scale-150 group-hover:text-white" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-md overflow-y-auto p-0"
          >
            <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
            <div id="sheet-logo" className="bg-primary flex w-full p-4">
              <Logo
                variant="logo-white"
                width={100}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </div>

            <div className="flex flex-col divide-y divide-muted-foreground">
              {/* Getting Started Section */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Getting Started</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {gettingStartedItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="mobile-nav-link"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Organisms Section */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Organisms</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {organismItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="mobile-nav-link"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Services Sections */}
              <div className="p-3">
                <h2 className="mobile-nav-section-header">Services</h2>
                <div className="grid grid-cols-1 gap-y-4">
                  {Object.entries(serviceItems).map(([key, section]) => (
                    <div key={key}>
                      <h3 className="mobile-nav-divider-title">
                        {section.title}
                      </h3>
                      <div className="grid grid-cols-2">
                        {section.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="mobile-nav-link"
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
          <Logo
            variant="logo-icon"
            width={100}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
      </div>

      <div className="flex">
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
      </div>
    </header>
  );
};

export default MobileNavbar;
