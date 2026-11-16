import type { OrganismLandingConfig } from "@/components/organisms/types";

/** The roots All Organisms spans: cellular organisms and Viruses. */
export const allOrganismRootIds = [131567, 10239] as const;

export const allOrganismsLandingConfig: OrganismLandingConfig = {
  displayName: "All Organisms",
  taxonId: allOrganismRootIds[0],
  accent: "all",
  defaultView: "overview",
  hideDisabledTabs: true,
  metadataFields: ["host_group", "isolation_country"],
};
