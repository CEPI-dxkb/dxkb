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
          <SheetContent side="left" className="rounded-r-xl border-none">
            <SheetTitle className="sr-only">
              DXKB
            </SheetTitle>
            <div id="sheet-logo" className="flex p-4 bg-primary-def rounded-tr-lg w-full">
              <Image
                src="/logos/dxkb-logo-white-cropped.svg"
                alt="DXKB Logo"
                width={100}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </div>

            <div id="sheet-content" className="flex flex-col gap-4 p-4">
              <div id="sheet-content-getting-started" className="sheet-content-section-mobile">
                <h2>Getting Started</h2>
                <h3><Link href="/introduction">Introduction</Link></h3>
                <h3><Link href="/installation">Installation</Link></h3>
                <h3><Link href="https://docs.dxkb.org">Documentation</Link></h3>
              </div>

              <div id="sheet-content-organisms" className="sheet-content-section-mobile">
                <h2>Organisms</h2>
                <h3><Link href="/organisms/viruses">Viruses</Link></h3>
                <h3><Link href="/organisms/bacteria">Bacteria</Link></h3>
                <h3><Link href="/organisms/fungi">Fungi</Link></h3>
                <h3><Link href="/organisms/all">Browse All</Link></h3>
              </div>

              <div id="sheet-content-utilities" className="sheet-content-section-mobile">
                <h2>Utilities</h2>
                <h3><Link href="/utilities/blast">BLAST Search</Link></h3>
                <h3><Link href="/utilities/genome-assembly">Genome Assembly</Link></h3>
                <h3><Link href="/utilities/sequence-analysis">Sequence Analysis</Link></h3>
                <h3><Link href="/utilities/all">All Utilities</Link></h3>
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