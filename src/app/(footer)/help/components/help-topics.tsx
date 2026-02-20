import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const HelpTopics = () => {
  return (
    <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Help Topics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.29 7 12 12 20.71 7" />
                    <line x1="12" y1="22" x2="12" y2="12" />
                  </svg>
                </div>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>Learn the basics of using VirusDB</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="text-link hover:underline">
                    <Link href="#">Creating an account</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Navigating the database</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Basic search techniques</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Understanding data formats</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">View all getting started guides →</Link>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-accent"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <CardTitle>Advanced Features</CardTitle>
                <CardDescription>Unlock the full potential of VirusDB</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="text-link hover:underline">
                    <Link href="#">Advanced search parameters</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Sequence alignment tools</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Phylogenetic analysis</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Batch processing data</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">View all advanced guides →</Link>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-secondary"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="M8 11h8" />
                    <path d="M12 15V7" />
                  </svg>
                </div>
                <CardTitle>Account & Security</CardTitle>
                <CardDescription>Manage your account settings and security</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="text-link hover:underline">
                    <Link href="#">Managing your profile</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">API access keys</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Two-factor authentication</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">Data privacy settings</Link>
                  </li>
                  <li className="text-link hover:underline">
                    <Link href="#">View all account guides →</Link>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
  )
}

export default HelpTopics