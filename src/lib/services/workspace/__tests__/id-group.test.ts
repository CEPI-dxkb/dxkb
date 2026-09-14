import {
  appendIdGroupContent,
  createIdGroupContent,
  parseIdGroupContent,
} from "../id-group";

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
}

describe("createIdGroupContent", () => {
  it("de-duplicates the supplied IDs", () => {
    expect(createIdGroupContent("Set", "genome_id", ["1.1", "1.1", "2.2"])).toEqual(
      { name: "Set", id_list: { genome_id: ["1.1", "2.2"] } },
    );
  });
});

describe("parseIdGroupContent", () => {
  it("parses plain JSON content", () => {
    expect(
      parseIdGroupContent('{"name":"Set","id_list":{"genome_id":["1.1"]}}'),
    ).toEqual({ name: "Set", id_list: { genome_id: ["1.1"] } });
  });

  it("accepts already-parsed content and preserves unrelated fields", () => {
    expect(
      parseIdGroupContent({
        name: "Set",
        note: "kept",
        id_list: { genome_id: ["1.1", "1.1"] },
      }),
    ).toEqual({ name: "Set", note: "kept", id_list: { genome_id: ["1.1"] } });
  });

  it("decodes the legacy base64 representation", () => {
    expect(
      parseIdGroupContent(
        toBase64('{"name":"Set","id_list":{"feature_id":["f.1"]}}'),
      ),
    ).toEqual({ name: "Set", id_list: { feature_id: ["f.1"] } });
  });

  it("decodes base64 content containing multi-byte characters", () => {
    expect(
      parseIdGroupContent(
        toBase64('{"name":"Grupo ñ – 変異","id_list":{"genome_id":["1.1"]}}'),
      ),
    ).toEqual({ name: "Grupo ñ – 変異", id_list: { genome_id: ["1.1"] } });
  });

  it("reports invalid content for text that is neither JSON nor base64 JSON", () => {
    expect(() => parseIdGroupContent("not json at all")).toThrow(
      "Workspace ID group contains invalid JSON content",
    );
    expect(() => parseIdGroupContent(toBase64("still not json"))).toThrow(
      "Workspace ID group contains invalid JSON content",
    );
  });

  it("rejects content without an id_list object", () => {
    expect(() => parseIdGroupContent('{"name":"Set"}')).toThrow(
      "Workspace ID group content must contain an id_list object",
    );
    expect(() => parseIdGroupContent(toBase64('{"name":"Set"}'))).toThrow(
      "Workspace ID group content must contain an id_list object",
    );
  });

  it("rejects an id_list field that is not a string array", () => {
    expect(() =>
      parseIdGroupContent('{"id_list":{"genome_id":[1.1]}}'),
    ).toThrow("Workspace ID group id_list.genome_id must be a string array");
  });
});

describe("appendIdGroupContent", () => {
  it("merges new IDs into the field without duplicates", () => {
    expect(
      appendIdGroupContent(
        { name: "Set", id_list: { genome_id: ["1.1"], feature_id: ["f.1"] } },
        "genome_id",
        ["1.1", "2.2"],
      ),
    ).toEqual({
      name: "Set",
      id_list: { genome_id: ["1.1", "2.2"], feature_id: ["f.1"] },
    });
  });

  it("creates the field when the group does not have it yet", () => {
    expect(
      appendIdGroupContent({ id_list: {} }, "feature_id", ["f.1"]),
    ).toEqual({ id_list: { feature_id: ["f.1"] } });
  });
});
