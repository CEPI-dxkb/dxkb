import { readFileSync } from "node:fs";
import { join } from "node:path";

// Dragging a Graph column re-lays out the protein list on every pointer move, which is slow with a
// row per protein. `content-visibility` fixes that, but left on it slows every style check on the
// rows (axe, Playwright's role locators) several times over, so it applies only during a drag.
// jsdom has no layout, so this holds the rule's selector, which the list's rows and the panel
// library's handle must keep matching.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const dragRule = css.match(
  /\[data-slot="resizable-panel-group"\]:has\(\[data-separator="active"\]\) \[data-node-id\]\s*\{([^}]*)\}/,
);

describe("Graph protein list while a column handle is dragged", () => {
  it("lets rows out of view skip layout, only while a handle is active", () => {
    expect(dragRule?.[1]).toContain("content-visibility: auto");
    expect(dragRule?.[1]).toContain("contain-intrinsic-size: auto 2rem");
  });

  it("never sets content-visibility on the rows outside that drag rule", () => {
    const withoutDragRule = css.replace(dragRule?.[0] ?? "", "");
    expect(withoutDragRule).not.toMatch(/data-node-id[^{]*\{[^}]*content-visibility/);
  });

  it("has no content-visibility in the shared command item", () => {
    const command = readFileSync(
      join(process.cwd(), "src/components/ui/command.tsx"),
      "utf8",
    );
    expect(command).not.toContain("content-visibility");
  });
});
