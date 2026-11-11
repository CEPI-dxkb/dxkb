"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SearchBar } from "@/components/search/search-bar";
import ThemeContent from "@/components/ui/theme-content";
import { useAuth, useResendVerificationEmail } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { AdvancedSearchDropdown } from "@/components/search/advanced-search-dropdown";
import { searchHref, searchTypes } from "@/constants/search-info";

const everythingType = searchTypes.find((t) => t.id === "everything");

const popularSearches = [
  "SARS-CoV-2",
  "Influenza A",
  "HIV-1",
  "Ebola virus",
  "Zika virus",
];

const WelcomeSearch = () => {
  const { isAuthenticated, isVerified } = useAuth();
  const resendVerificationEmail = useResendVerificationEmail();

  return (
    <section className="grow">
      <div className="bg-linear-to-b from-primary to-background py-16 md:py-8">
        {isAuthenticated && !isVerified && (
          <div className="container mx-auto px-4">
            <Alert variant="destructive">
              <AlertTitle>Unverified Account Email</AlertTitle>
              <AlertDescription>
                <span>
                  Please verify your email to continue using the platform. Click{" "}
                  <button
                    type="button"
                    onClick={() => {
                      void resendVerificationEmail();
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline hover:text-foreground focus:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    here
                  </button>{" "}
                  to resend the verification email.
                </span>
              </AlertDescription>
            </Alert>
          </div>
        )}
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-4 text-3xl font-bold text-white md:mt-16 md:text-4xl lg:text-5xl">
            <ThemeContent type="welcome-title" as="span" />
          </h1>
          <h3 className="mx-auto mb-8 max-w-3xl text-lg font-normal text-white/80">
            <ThemeContent type="welcome-subtitle" as="span" />
          </h3>

          <div className="mx-auto max-w-4xl">
            <div className="welcome-search-card rounded-lg bg-card p-6 shadow-lg">
              <Tabs defaultValue="basic" className="w-full">
                <div className="mb-4 flex items-end gap-2">
                  <TabsList>
                    <TabsTrigger value="basic">Basic Search</TabsTrigger>
                  </TabsList>
                  <AdvancedSearchDropdown variant="tab" />
                </div>

                <TabsContent value="basic">
                  <SearchBar size="lg" />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="mr-2 text-sm text-muted-foreground">
                      Popular searches:
                    </span>
                    {everythingType &&
                      popularSearches.map((term) => (
                        <Badge
                          key={term}
                          variant="secondary"
                          className="cursor-pointer"
                          render={<Link href={searchHref(everythingType, term)} />}
                        >
                          {term}
                        </Badge>
                      ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WelcomeSearch;
