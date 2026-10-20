import Link from "next/link";

import Footer from "@/components/footers/footer";
import Navbar from "@/components/navbars/navbar";
import { SearchBar } from "@/components/search/search-bar";

// An unknown URL, or a notFound() from a route with no not-found page of its
// own. It replaces the segment's layout, so it brings the navbar and footer.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl grow flex-col gap-6 px-4 py-12">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="my-2 text-sm text-muted-foreground">
            The page you requested does not exist or has moved. Search for it,
            or start again from the home page.
          </p>
          <Link className="text-link underline underline-offset-2" href="/">
            Go to the home page
          </Link>
        </div>
        <section aria-label="Search DXKB">
          <SearchBar />
        </section>
      </main>
      <Footer />
    </div>
  );
}
