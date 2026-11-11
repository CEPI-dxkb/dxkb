"use client";

import Footer from "@/components/footers/footer";
import Navbar from "@/components/navbars/navbar";
import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// Replaces the segment's layout, so it brings the navbar and footer itself.
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
