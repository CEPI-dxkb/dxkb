import {
  outageRecordShape,
  outageRecords,
  outageServiceFor,
  outageSessionToken,
  parseOutageDirective,
} from "../outages";

describe("outageSessionToken / parseOutageDirective", () => {
  it("round-trips the outages a token asks for", () => {
    const token = outageSessionToken("e2e-test-user@patricbrc.org", {
      workspace: "maintenance",
      "app-service": "hang",
    });

    expect(token).toMatch(/^un=e2e-test-user@patricbrc\.org\|/);
    // Only cookie octets: no space, comma, semicolon, quote or backslash.
    expect(token).not.toMatch(/[\s,;"\\]/);
    expect(parseOutageDirective(token)).toEqual({
      kind: "outages",
      outages: { workspace: "maintenance", "app-service": "hang" },
    });
  });

  it("needs at least one outage", () => {
    expect(() => outageSessionToken("user", {})).toThrow(/at least one/);
  });

  it("reads no directive from a plain token or none", () => {
    expect(parseOutageDirective(null)).toEqual({ kind: "none" });
    expect(parseOutageDirective("un=user|tokenid=1|sig=abc")).toEqual({
      kind: "none",
    });
  });

  it("calls an unknown service invalid", () => {
    expect(parseOutageDirective("un=u|e2e-outage=shock:hang")).toMatchObject({
      kind: "invalid",
      reason: expect.stringContaining("unknown outage service 'shock'") as unknown,
    });
  });
});

describe("outageServiceFor", () => {
  it.each([
    ["user/e2e-test-user@patricbrc.org", "user"],
    ["user-auth", "user"],
    ["workspace", "workspace"],
    ["app-service", "app-service"],
    ["data/genome", "data"],
    ["bvbrc-website/taxonomy/1", "data"],
    ["phylo-manifest", undefined],
  ])("%s belongs to %s", (path, service) => {
    expect(outageServiceFor(path)).toBe(service);
  });
});

describe("outageRecordShape", () => {
  it("finds each record id as a whole term", () => {
    expect(
      outageRecordShape(`eq(genome_id,${outageRecords.hang.genomeId})`),
    ).toBe("hang");
    expect(
      outageRecordShape(`taxonomy/${outageRecords.maintenance.taxonId}`),
    ).toBe("maintenance");
    expect(
      outageRecordShape(`keyword(${outageRecords.maintenance.keyword})`),
    ).toBe("maintenance");
    expect(outageRecordShape("eq(genome_id,83332.12)")).toBeUndefined();
  });
});
