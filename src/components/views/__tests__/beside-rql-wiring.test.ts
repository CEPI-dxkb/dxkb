import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const viewsDir = path.resolve(__dirname, "..");
const wrappers = readdirSync(viewsDir).filter(
  (file) =>
    file.endsWith("-resource-collection.tsx") &&
    readFileSync(path.join(viewsDir, file), "utf8").includes(
      "useCollectionUrlState(",
    ),
);

describe("collection wrappers keep facet picks beside a custom query", () => {
  it("finds the wrappers", () => {
    expect(wrappers.length).toBeGreaterThanOrEqual(10);
  });

  it.each(wrappers)("%s passes filtersBesideRql to ResourceCollection", (file) => {
    const source = readFileSync(path.join(viewsDir, file), "utf8");
    expect(source).toMatch(/filtersBesideRql=\{\[\s*\.\.\.filtersBesideRql\(/);
  });
});
