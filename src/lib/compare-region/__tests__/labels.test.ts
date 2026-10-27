import { testGene } from "@/test-helpers/compare-region";
import { densitySpecs } from "../density";
import type { GlyphKind } from "../figure-frame";
import { fitText, glyphLabel, labelFont, labelForms } from "../labels";
import type { PlacedFeature } from "../layout";
import { estimateTextWidth } from "../text-measure";

const { comfortable, compact } = densitySpecs;

function placed(product: string): PlacedFeature {
  return {
    feature: testGene("fig|1.1.peg.9", 1, 300, { product, family: 4 }),
    from: 0,
    to: 300,
    lane: 0,
  };
}

describe("labelForms", () => {
  // Products from the 10-genome answer (`fixtures/rows-10.json`).
  it.each([
    [
      "SSU ribosomal protein S4p (S9e) @ SSU ribosomal protein S4p (S9e), zinc-independent",
      ["SSU ribosomal protein S4p", "S4p"],
    ],
    [
      "LSU ribosomal protein L36p @ LSU ribosomal protein L36p, zinc-dependent",
      ["LSU ribosomal protein L36p", "L36p"],
    ],
    [
      "Protein translocase subunit SecY",
      ["Protein translocase subunit SecY", "SecY"],
    ],
    [
      "Dihydrolipoamide dehydrogenase of pyruvate dehydrogenase complex (EC 1.8.1.4)",
      [
        "Dihydrolipoamide dehydrogenase of pyruvate dehydrogenase complex",
        "Dihydrolipoamide dehydrogenase",
      ],
    ],
    ["Catalase KatE (EC 1.11.1.6)", ["Catalase KatE", "KatE"]],
    [
      "Hydroxymethylpyrimidine phosphate kinase ThiD (EC 2.7.4.7)",
      ["Hydroxymethylpyrimidine phosphate kinase ThiD", "ThiD"],
    ],
    [
      "DnaA inactivator Hda (shorter homolog of DnaA)",
      ["DnaA inactivator Hda", "Hda"],
    ],
    ["Veg protein", ["Veg protein", "Veg"]],
    ["UspA", ["UspA"]],
    [
      "Protein IscX, believed to be involved in assembly of Fe-S clusters",
      ["Protein IscX", "IscX"],
    ],
    [
      "Transcriptional regulator SPy2172, PadR family",
      ["Transcriptional regulator SPy2172"],
    ],
    ["Acetyltransferase, GNAT family", ["Acetyltransferase"]],
    [
      "Glycolate dehydrogenase (EC 1.1.99.14), subunit GlcD",
      ["Glycolate dehydrogenase", "GlcD"],
    ],
    [
      "Replicative DNA helicase (DnaB) (EC 3.6.4.12)",
      ["Replicative DNA helicase"],
    ],
    [
      "16S rRNA (cytidine(1402)-2'-O)-methyltransferase (EC 2.1.1.198)",
      ["16S rRNA (cytidine(1402)-2'-O)-methyltransferase"],
    ],
    [
      "Guanosine-3',5'-bis(diphosphate) 3'-pyrophosphohydrolase (EC 3.1.7.2) / GTP pyrophosphokinase (EC 2.7.6.5), (p)ppGpp synthetase II",
      ["Guanosine-3',5'-bis(diphosphate) 3'-pyrophosphohydrolase"],
    ],
    [
      "Protein of unknown function DUF1304",
      ["Protein of unknown function DUF1304"],
    ],
    [
      "Probably membrane associated protein containing PAS/PAC domain",
      [
        "Probably membrane associated protein containing PAS/PAC domain",
        "Probably membrane associated protein",
      ],
    ],
    [
      "Uncharacterized chaperone protein YegD",
      ["Uncharacterized chaperone protein YegD", "YegD"],
    ],
    ["Uncharacterized protein YraP", ["Uncharacterized protein YraP", "YraP"]],
    [
      "Lead, cadmium, zinc and mercury transporting ATPase",
      ["Lead, cadmium, zinc and mercury transporting ATPase"],
    ],
    ["Esterase/lipase", ["Esterase/lipase"]],
  ])("shortens %s", (product, forms) => {
    expect(labelForms(product)).toEqual({ forms, quiet: false });
  });

  it("marks hypothetical proteins quiet, but not named uncharacterized ones", () => {
    expect(labelForms("hypothetical protein")).toEqual({
      forms: ["hypothetical protein"],
      quiet: true,
    });
    expect(labelForms("FIG00450941: hypothetical protein")).toEqual({
      forms: ["hypothetical protein"],
      quiet: true,
    });
    expect(labelForms("Uncharacterized chaperone protein YegD").quiet).toBe(
      false,
    );
  });

  it("has no form for a missing product", () => {
    expect(labelForms("")).toEqual({ forms: [], quiet: false });
  });

  it("answers the same product with the same object", () => {
    const product = "Catalase KatE (EC 1.11.1.6)";
    expect(labelForms(product)).toBe(labelForms(product));
  });

  it("forgets its forms past 5,000 products, so the cache never grows without bound", () => {
    const product = "Excinuclease ABC subunit A";
    const first = labelForms(product);
    for (let index = 0; index < 5000; index += 1) {
      labelForms(`Hypothetical protein ${String(index)}`);
    }
    const again = labelForms(product);
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
  });
});

describe("labelFont", () => {
  it("is the density's label size at weight 500, italic when quiet", () => {
    expect(labelFont(comfortable)).toBe("500 10px");
    expect(labelFont(compact)).toBe("500 9.5px");
    expect(labelFont(comfortable, true)).toBe("italic 500 10px");
  });
});

describe("glyphLabel", () => {
  const item = placed("Protein translocase subunit SecY");
  const box = { top: 46, bottom: 62 };
  const label = (x1: number, x2: number, kind: GlyphKind = "gene") =>
    glyphLabel(comfortable, kind, item, x1, x2, box, 800, estimateTextWidth);

  it("labels only what fits whole, centered in the gene's body", () => {
    // Body 0–93, room 3.5–89.5: the phrase (179.2 px) does not fit.
    expect(label(0, 100)).toEqual({
      text: "SecY",
      x: 46.5,
      y: 57.5,
      quiet: false,
    });
    expect(label(0, 300)?.text).toBe("Protein translocase subunit SecY");
    expect(label(0, 20)).toBeNull();
  });

  it("keeps the head clear on the minus strand", () => {
    // Body 7–100, room 10.5–96.5.
    expect(label(100, 0)).toEqual(
      expect.objectContaining({ text: "SecY", x: 53.5 }),
    );
  });

  it("fits the label in the part of the gene on screen", () => {
    expect(label(-50, 60)).toEqual(
      expect.objectContaining({ text: "SecY", x: 26.5 }),
    );
    expect(label(750, 900)).toEqual(
      expect.objectContaining({ text: "SecY", x: 775 }),
    );
  });

  it("labels a body wholly off the plot in all of it", () => {
    // Drawn ahead of a drag: centered in its whole body, to slide into view.
    expect(label(-300, -200)).toEqual(
      expect.objectContaining({ text: "SecY", x: -253.5 }),
    );
    expect(label(900, 1000)).toEqual(
      expect.objectContaining({ text: "SecY", x: 946.5 }),
    );
    // Partly on it: still only the part in view.
    expect(label(-50, 60)?.x).toBe(26.5);
  });

  it("never labels a BLAST hit, an other feature or a gene with no product", () => {
    expect(label(0, 300, "blast")).toBeNull();
    expect(label(0, 300, "other")).toBeNull();
    expect(label(0, 300, "pseudo")?.text).toBe(
      "Protein translocase subunit SecY",
    );
    expect(
      glyphLabel(
        comfortable,
        "gene",
        placed(""),
        0,
        300,
        box,
        800,
        estimateTextWidth,
      ),
    ).toBeNull();
  });

  it("skips Compact's slim overlap lanes, but labels its first lane", () => {
    expect(
      glyphLabel(
        compact,
        "gene",
        item,
        0,
        100,
        { top: 0, bottom: 8 },
        800,
        estimateTextWidth,
      ),
    ).toBeNull();
    expect(
      glyphLabel(
        compact,
        "gene",
        item,
        0,
        100,
        { top: 0, bottom: 12 },
        800,
        estimateTextWidth,
      ),
    ).toEqual({ text: "SecY", x: 47.25, y: 9.3, quiet: false });
  });

  it("measures quiet products in italic", () => {
    const measure = vi.fn(estimateTextWidth);
    const quiet = glyphLabel(
      comfortable,
      "orphan",
      placed("hypothetical protein"),
      0,
      300,
      box,
      800,
      measure,
    );
    expect(quiet).toEqual(
      expect.objectContaining({ text: "hypothetical protein", quiet: true }),
    );
    expect(measure).toHaveBeenCalledWith(
      "hypothetical protein",
      "italic 500 10px",
    );
    measure.mockClear();
    glyphLabel(comfortable, "gene", item, 0, 300, box, 800, measure);
    expect(measure).toHaveBeenCalledWith(
      "Protein translocase subunit SecY",
      "500 10px",
    );
  });
});

describe("fitText", () => {
  const fit = (text: string, maxWidth: number) =>
    fitText(text, maxWidth, "10px", estimateTextWidth);

  it("keeps text that fits", () => {
    expect(fit("Escherichia coli", 200)).toBe("Escherichia coli");
  });

  it("cuts text that does not fit with an ellipsis, trimming the space before it", () => {
    expect(fit("Escherichia coli", 60)).toBe("Escherich…");
    expect(fit("Salmonella enterica", 65)).toBe("Salmonella…");
    expect(fit("Escherichia coli", 23)).toBe("Esc…");
  });

  it("is empty when fewer than three characters, or no room at all, would show", () => {
    expect(fit("Escherichia coli", 20)).toBe("");
    expect(fit("Escherichia coli", 0)).toBe("");
    expect(fit("Escherichia coli", -5)).toBe("");
  });
});
