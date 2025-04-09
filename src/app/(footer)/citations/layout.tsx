import FooterHeader from "@/components/headers/footer-header"
import type React from "react"
export default function CitationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <FooterHeader title="Citations" />
      {children}
    </div>
  )
}
