"use client";

import "./globals.css";

import {
  type RouteErrorProps,
  ViewErrorBoundary,
} from "@/components/errors/view-error-boundary";

// Only for an error in the root layout itself (the session or preference
// lookup), which takes the providers down with it. It replaces the whole
// document, so it renders its own <html> and <body> and nothing that needs a
// provider (the navbar reads auth and query state).
export default function GlobalError(props: RouteErrorProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <title>DXKB could not be loaded</title>
        <main className="mx-auto flex w-full max-w-3xl flex-col py-16">
          <ViewErrorBoundary
            {...props}
            title="DXKB could not be loaded"
            backHref="/"
            backLabel="Go to the home page"
          />
        </main>
      </body>
    </html>
  );
}
