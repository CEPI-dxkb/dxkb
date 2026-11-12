import { genomeGroupHref } from "@/lib/genome-view/genome-group-href";
import { maxRqlInValues } from "@/lib/data-api/rql";

describe("genomeGroupHref", () => {
  it("opens the Genome list Overview scoped to the group's ids", () => {
    expect(genomeGroupHref(["29461.10", "1218315.3"])).toEqual({
      ok: true,
      href: "/genome?rql=in(genome_id,(29461.10,1218315.3))&tab=overview",
    });
  });

  it("drops blank and duplicate ids", () => {
    expect(genomeGroupHref(["1.1", "", "1.1", "2.2"])).toEqual({
      ok: true,
      href: "/genome?rql=in(genome_id,(1.1,2.2))&tab=overview",
    });
  });

  it("reports an empty group instead of building a link", () => {
    expect(genomeGroupHref([])).toEqual({
      ok: false,
      message: "This genome group has no genomes.",
    });
  });

  it("reports a group larger than the list's in() limit", () => {
    const ids = Array.from(
      { length: maxRqlInValues + 1 },
      (_, i) => `${String(i)}.1`,
    );
    const result = genomeGroupHref(ids);
    expect(result.ok).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          `up to ${maxRqlInValues.toLocaleString()}`,
        ) as unknown as string,
      }),
    );
  });
});
