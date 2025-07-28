"use client";

import { SelectionProvider } from "./SelectionContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      {children}
    </SelectionProvider>
  );
}
