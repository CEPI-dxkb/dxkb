"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SearchBar } from "@/components/search/search-bar";
import ThemeContent from "@/components/ui/theme-content";
import { useAuth, useResendVerificationEmail } from "@/lib/auth/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CardFieldInput,
  CardFieldLabel,
} from "@/components/services/form-ui/card-field";
import { searchHref, searchTypes } from "@/constants/search-info";

const everythingType = searchTypes.find((t) => t.id === "everything")!;

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
  const router = useRouter();

  return (
    <section className="grow">
      {/* Hero Section with Search */}
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

          {/* Search Interface */}
          <div className="mx-auto max-w-4xl">
            <div className="welcome-search-card rounded-lg bg-card p-6 shadow-lg">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Search</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
                  <TabsTrigger value="sequence">Sequence Search</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <SearchBar size="lg" />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="mr-2 text-sm text-muted-foreground">
                      Popular searches:
                    </span>
                    {popularSearches.map((term) => (
                      <Badge
                        key={term}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(searchHref(everythingType, term))
                        }
                      >
                        {term}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="advanced">
                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <CardFieldLabel>Taxonomy</CardFieldLabel>
                      <CardFieldInput
                        type="text"
                        placeholder="e.g., Coronaviridae"
                      />
                    </div>
                    <div>
                      <CardFieldLabel>Host</CardFieldLabel>
                      <CardFieldInput
                        type="text"
                        placeholder="e.g., Homo sapiens"
                      />
                    </div>
                    <div>
                      <CardFieldLabel>Genome Type</CardFieldLabel>
                      <CardFieldInput
                        type="text"
                        placeholder="e.g., ssRNA(+)"
                      />
                    </div>
                    <div>
                      <CardFieldLabel>Protein Function</CardFieldLabel>
                      <CardFieldInput
                        type="text"
                        placeholder="e.g., Polymerase"
                      />
                    </div>
                  </div>
                  <Button variant="cta" className="w-full">
                    Submit Advanced Search
                  </Button>
                </TabsContent>

                {/* TODO: wire sequence pre-fill once BLAST page supports URL params */}
                <TabsContent value="sequence">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Use the BLAST service to search by nucleotide or protein
                    sequence against public or private genomes and databases.
                  </p>
                  <Button
                    variant="cta"
                    className="w-full"
                    onClick={() => router.push("/services/blast")}
                  >
                    Open BLAST Service
                  </Button>
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
