import { describeCopilotPage } from "../page-context";

const site = "The user is on DXKB (the Disease X Knowledge Base)";

describe("describeCopilotPage", () => {
  it.each([
    ["/genome/1234.5", "", "the page for genome 1234.5"],
    ["/taxonomy/10244", "?tab=genomes", "the page for taxon 10244 (genomes tab)"],
    ["/genome", "?rql=eq(genus,Escherichia)", "a list of genomes filtered by the RQL query eq(genus,Escherichia)"],
    ["/feature", "", "the list of genomic features"],
    ["/workspace/user@bvbrc/home/Assemblies", "", "their workspace folder user@bvbrc/home/Assemblies"],
    ["/jobs", "", "their list of submitted jobs"],
    ["/services/genome-assembly", "", "the submission form for the genome assembly service"],
    ["/organisms/viruses", "", "the viruses organism overview"],
    ["/", "", "the DXKB home page"],
  ])("describes %s%s", (pathname, search, view) => {
    const sentence = describeCopilotPage(pathname, search);
    expect(sentence).toContain(site);
    expect(sentence).toContain(`They are viewing ${view} (URL path ${pathname}).`);
  });

  it("says only where the user is for a page it does not describe", () => {
    const sentence = describeCopilotPage("/copilot");
    expect(sentence).toContain(site);
    expect(sentence).not.toContain("They are viewing");
  });

  it.each(["/constructor/x", "/__proto__", "/toString", "/hasOwnProperty?rql=a"])(
    "describes %s as an undescribed page",
    (url) => {
      const [pathname, search = ""] = url.split("?");
      expect(describeCopilotPage(pathname, search)).toBe(
        describeCopilotPage("/copilot"),
      );
    },
  );

  it.each(["/organisms/" + "a".repeat(5000), "/organisms/viruses/" + "a".repeat(5000), "/services/" + "a".repeat(5000)])(
    "bounds a long path segment (%#)",
    (pathname) => {
      const sentence = describeCopilotPage(pathname);
      expect(sentence).toContain("They are viewing");
      expect(sentence.length).toBeLessThan(2000);
    },
  );

  it("bounds values taken from the URL", () => {
    const sentence = describeCopilotPage("/genome", `?rql=${"a".repeat(5000)}`);
    expect(sentence.length).toBeLessThan(2000);
  });
});
