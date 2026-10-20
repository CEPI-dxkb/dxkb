"use client";

import Footer from "@/components/footers/footer";
import Navbar from "@/components/navbars/navbar";
import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// Catches a server or render error in any route without its own boundary
// (home, search, jobs, services, workspace, settings, the footer pages). It
// replaces the segment's layout, so it brings the navbar and footer itself;
// the root layout's providers stay mounted around it.
export default function RootError(props: RouteErrorProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl grow flex-col py-8">
        <ViewErrorBoundary
          {...props}
          title="This page could not be loaded"
          backHref="/"
          backLabel="Go to the home page"
        />
      </main>
      <Footer />
    </div>
  );
}
