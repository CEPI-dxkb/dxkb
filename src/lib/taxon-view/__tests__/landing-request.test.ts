import type { OrganismLandingView } from "@/components/organisms/types";

import { resolveLandingTab } from "../landing-request";

function Component() {
  return null;
}

const defaultRequests: [
  Parameters<typeof resolveLandingTab>[0],
  string | null,
][] = [
  [undefined, null],
  [{}, null],
  [{ tab: "" }, ""],
  [{ tab: [] }, null],
];

// A legacy `view` request opens its view with a null tabParam, since a legacy link has no `tab` in the URL.
const enabledRequests: [
  Parameters<typeof resolveLandingTab>[0],
  "genomes" | "features",
  string | null,
][] = [
  [{ tab: "genomes" }, "genomes", "genomes"],
  [{ view: "features" }, "features", null],
  [{ tab: ["features", "genomes"] }, "features", "features"],
  [{ view: ["genomes", "features"] }, "genomes", null],
];

const views = [
  { key: "overview", label: "Overview", icon: null, Component },
  { key: "genomes", label: "Genomes", icon: null, Component },
  { key: "features", label: "Features", icon: null, Component },
  {
    key: "phylogeny",
    label: "Phylogeny",
    icon: null,
    Component,
    enabled: false,
  },
] satisfies OrganismLandingView[];

describe("resolveLandingTab", () => {
  it.each(defaultRequests)(
    "uses the default view when no tab is requested: %j",
    (params, tabParam) => {
      expect(resolveLandingTab(params, views)).toEqual({
        tabParam,
        redirectToOverview: false,
      });
    },
  );

  it.each(enabledRequests)(
    "accepts an enabled request: %j",
    (params, activeViewKey, tabParam) => {
      expect(resolveLandingTab(params, views)).toEqual({
        activeViewKey,
        tabParam,
        redirectToOverview: false,
      });
    },
  );

  it("gives the canonical tab parameter precedence over the legacy view parameter", () => {
    expect(resolveLandingTab({ tab: "genomes", view: "features" }, views)).toEqual({
      activeViewKey: "genomes",
      tabParam: "genomes",
      redirectToOverview: false,
    });
  });

  it("falls back to the legacy view when tab is empty", () => {
    expect(resolveLandingTab({ tab: "", view: "features" }, views)).toEqual({
      activeViewKey: "features",
      tabParam: "",
      redirectToOverview: false,
    });
  });

  it.each([{ tab: "missing" }, { tab: "phylogeny" }, { view: "phylogeny" }])(
    "redirects unknown and disabled requests: %j",
    (params) => {
      expect(resolveLandingTab(params, views)).toEqual({ redirectToOverview: true });
    },
  );
});
