import {
  serviceItems,
  workspaceNavItems,
} from "@/components/navbars/navbar-links";
import { resolveWorkspaceHref } from "@/components/navbars/workspace-nav-utils";
import { copilotName } from "@/lib/copilot/name";

import { authLinkHref, signInPrompt } from "../sign-in-prompt";

const generic = "To continue, you must sign in or create an account.";

function to(phrase: string): string {
  return `To access ${phrase}, you must sign in or create an account.`;
}

describe("signInPrompt", () => {
  it.each([
    ["no redirect", null],
    ["an undefined redirect", undefined],
    ["an empty redirect", ""],
    ["the site root", "/"],
    ["a protocol-relative URL", "//evil.example/x"],
    ["an absolute URL", "https://evil.example/x"],
  ])("has nothing to name for %s", (_name, redirect) => {
    expect(signInPrompt(redirect)).toBeNull();
  });

  it.each([
    ["/services/blast", "the BLAST service"],
    ["/services/msa-snp-analysis", "the MSA and SNP Analysis service"],
    ["/services/blast?x=1", "the BLAST service"],
    ["/jobs", "your jobs"],
    ["/jobs?status=failed", "your jobs"],
    ["/settings", "your settings"],
    ["/copilot", copilotName],
    ["/viewer/structure/alice@bvbrc/home/x.pdb", "the structure viewer"],
    ["/genome?public=false", "your genomes"],
  ])("names %s", (redirect, phrase) => {
    expect(signInPrompt(redirect)).toBe(to(phrase));
  });

  it.each([
    ["/workspace", "your Home workspace directory"],
    ["/workspace/home", "your Home workspace directory"],
    ["/workspace/home/Genome%20Groups", "your Genome Groups"],
    ["/workspace/home/Feature%20Groups", "your Feature Groups"],
    ["/workspace/home/Genome%20Groups/Sub", "your “Sub” folder"],
    ["/workspace/home/My%20Reads", "your “My Reads” folder"],
    ["/workspace/home/100%", "your “100%” folder"],
    ["/workspace/shared", "your workspaces"],
    ["/workspace/shared/ws1/data", "the “data” folder"],
    ["/workspace/public", "the Public Workspaces page"],
    ["/workspace/public/alice@bvbrc", "this public workspace"],
    [
      "/workspace/public/ARWattam@patricbrc.org/BV-BRC%20Workshop",
      "the “BV-BRC Workshop” folder",
    ],
    ["/workspace/workshop", "the BV-BRC Workshop page"],
    ["/workspace/alice@bvbrc", "this workspace"],
    ["/workspace/alice@bvbrc/home", "the Home workspace directory"],
    [
      "/workspace/alice@bvbrc/home/Genome%20Groups",
      "the “Genome Groups” folder",
    ],
    ["/workspace/alice@bvbrc/shared-folder/x", "the “x” folder"],
  ])("names the workspace page %s", (redirect, phrase) => {
    expect(signInPrompt(redirect)).toBe(to(phrase));
  });

  it("shortens a very long folder name", () => {
    expect(signInPrompt(`/workspace/home/${"a".repeat(80)}`)).toBe(
      to(`your “${"a".repeat(59)}…” folder`),
    );
  });

  it("shortens a very long emoji name without splitting a surrogate pair", () => {
    const emoji = "😀";

    expect(
      signInPrompt(`/workspace/home/${encodeURIComponent(emoji.repeat(70))}`),
    ).toBe(to(`your “${emoji.repeat(59)}…” folder`));
  });

  it.each([
    ["a bidi override", "/workspace/home/a%E2%80%AEb", "your “ab” folder"],
    ["a NUL", "/workspace/home/a%00b", "your “ab” folder"],
    ["a newline", "/workspace/home/a%0Ab", "your “ab” folder"],
    ["a run of spaces", "/workspace/home/a%20%20%20b", "your “a b” folder"],
    [
      "a curly closing quote",
      "/workspace/home/a%E2%80%9D%20b%E2%80%9C",
      "your “a b” folder",
    ],
    ["straight quotes", "/workspace/home/%22x%22", "your “x” folder"],
  ])("cleans %s out of a folder name: %s", (_name, redirect, phrase) => {
    expect(signInPrompt(redirect)).toBe(to(phrase));
  });

  it.each([
    ["your own folder named only by a bidi control", "/workspace/home/%E2%80%AE"],
    [
      "a shared folder named only by a bidi control",
      "/workspace/shared/ws1/%E2%80%AE",
    ],
    [
      "a name of only quotes",
      "/workspace/home/%22%E2%80%9C%E2%80%9D",
    ],
  ])("falls back to the generic sentence for %s", (_name, redirect) => {
    expect(signInPrompt(redirect)).toBe(generic);
  });

  it.each([
    "/services",
    "/services/not-a-service",
    "/genome",
    "/taxonomy/2955291?tab=strains",
    "/search?q=flu",
    "/viewer",
    "/workspace/home/%20",
  ])("falls back to the generic sentence for %s", (redirect) => {
    expect(signInPrompt(redirect)).toBe(generic);
  });

  it("names every internal service in the Services menu", () => {
    const services = Object.values(serviceItems)
      .flatMap(
        (section) =>
          section.items as readonly { title: string; href: string }[],
      )
      .filter((item) => item.href.startsWith("/services/"));

    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      expect(signInPrompt(service.href), service.title).toBe(
        to(`the ${service.title} service`),
      );
    }
  });

  it("names the destination of every signed-out Workspace menu item", () => {
    for (const section of Object.values(workspaceNavItems)) {
      for (const item of section.items) {
        const href = resolveWorkspaceHref(item, "", false);
        const redirect = new URL(href, "https://dxkb.internal").searchParams.get(
          "redirect",
        );
        const prompt = signInPrompt(redirect);

        expect(prompt, item.title).not.toBeNull();
        expect(prompt, item.title).not.toBe(generic);
      }
    }
  });
});

describe("authLinkHref", () => {
  it.each([
    ["/sign-up", null, "/sign-up"],
    ["/sign-up", "/", "/sign-up"],
    ["/sign-up", "https://evil.example", "/sign-up"],
    ["/sign-up", "/services/blast", "/sign-up?redirect=/services/blast"],
    [
      "/sign-in",
      "/workspace/home/Genome%20Groups",
      "/sign-in?redirect=/workspace/home/Genome%2520Groups",
    ],
  ] as const)("%s with redirect %s is %s", (path, redirect, expected) => {
    expect(authLinkHref(path, redirect)).toBe(expected);
  });
});
