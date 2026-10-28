import {
  defaultCompareRegionSettings,
  type CompareRegionSettings,
} from "../contract";
import {
  canApplyDraft,
  draftOf,
  draftToSettings,
  sameDraft,
} from "../settings-draft";

const applied = defaultCompareRegionSettings;
const genomeGroup = "/u@bvbrc/home/Genome Groups/G1";
const featureGroup = "/u@bvbrc/home/Feature Groups/F1";

describe("draftOf", () => {
  it("starts from the applied settings, with no group picked", () => {
    expect(draftOf(applied)).toEqual({
      size: 10000,
      genomes: 10,
      method: "pgfam",
      filter: "reference",
      genomeGroup: "",
      featureGroup: "",
    });
  });

  it("puts the applied group in its own source's slot", () => {
    const settings: CompareRegionSettings = {
      ...applied,
      filter: "featureGroup",
      group: featureGroup,
    };
    expect(draftOf(settings)).toEqual(
      expect.objectContaining({
        filter: "featureGroup",
        genomeGroup: "",
        featureGroup,
      }),
    );
    expect(
      draftOf({ ...applied, filter: "genomeGroup", group: genomeGroup }),
    ).toEqual(expect.objectContaining({ genomeGroup, featureGroup: "" }));
  });
});

describe("the settings draft", () => {
  it("has nothing to apply at first", () => {
    expect(canApplyDraft(draftOf(applied), applied)).toBe(false);
  });

  it("applies a changed genome count with the reference source and no group", () => {
    const draft = { ...draftOf(applied), genomes: 20 as const };
    expect(canApplyDraft(draft, applied)).toBe(true);
    expect(draftToSettings(draft)).toEqual({
      size: 10000,
      genomes: 20,
      method: "pgfam",
      filter: "reference",
      group: null,
    });
  });

  it("cannot apply a group source until a group is picked", () => {
    const draft = { ...draftOf(applied), filter: "genomeGroup" as const };
    expect(canApplyDraft(draft, applied)).toBe(false);
    expect(draftToSettings(draft).group).toBeNull();

    const picked = { ...draft, genomeGroup };
    expect(canApplyDraft(picked, applied)).toBe(true);
    expect(draftToSettings(picked)).toEqual({
      ...applied,
      filter: "genomeGroup",
      group: genomeGroup,
    });
  });

  it("cannot apply a feature group source with no path, or a relative path", () => {
    const features = { ...draftOf(applied), filter: "featureGroup" as const };
    expect(canApplyDraft(features, applied)).toBe(false);
    expect(
      canApplyDraft(
        {
          ...draftOf(applied),
          filter: "genomeGroup",
          genomeGroup: "u@bvbrc/home/G1",
        },
        applied,
      ),
    ).toBe(false);
  });

  it("keeps each source's group when switching between them", () => {
    const genomes = {
      ...draftOf(applied),
      filter: "genomeGroup" as const,
      genomeGroup,
    };
    const features = {
      ...genomes,
      filter: "featureGroup" as const,
      featureGroup,
    };
    expect(draftToSettings(features)).toEqual(
      expect.objectContaining({ filter: "featureGroup", group: featureGroup }),
    );
    const back = { ...features, filter: "genomeGroup" as const };
    expect(back).toEqual(
      expect.objectContaining({ genomeGroup, featureGroup }),
    );
    expect(draftToSettings(back)).toEqual(
      expect.objectContaining({ filter: "genomeGroup", group: genomeGroup }),
    );
  });

  it("ignores the path of a source that is not chosen", () => {
    const stale = { ...draftOf(applied), genomeGroup };
    expect(sameDraft(stale, draftOf(applied))).toBe(true);
    expect(canApplyDraft(stale, applied)).toBe(false);
    expect(draftToSettings(stale).group).toBeNull();
  });

  it("compares the chosen source's path", () => {
    const settings: CompareRegionSettings = {
      ...applied,
      filter: "genomeGroup",
      group: genomeGroup,
    };
    const other = { ...draftOf(settings), genomeGroup: "/u@bvbrc/home/G2" };
    expect(sameDraft(other, draftOf(settings))).toBe(false);
    expect(canApplyDraft(other, settings)).toBe(true);
  });

  it("has nothing to apply once a group is applied", () => {
    const draft = {
      ...draftOf(applied),
      filter: "genomeGroup" as const,
      genomeGroup,
    };
    const next = draftToSettings(draft);
    expect(canApplyDraft(draft, next)).toBe(false);
    expect(draftToSettings(draftOf(next))).toEqual(next);
  });
});
