import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { valueImportsMatching } from "@/test-helpers/static-imports";

const srcDir = resolve(__dirname, "..");

const folderPicker = /^@\/components\/workspace\/folder-picker\/folder-picker-dialog$/;
const groupDialog = /^@\/components\/workspace\/selection-to-group-dialog$/;
const csvViewer =
  /^@\/components\/workspace\/file-viewer\/viewers\/csv-viewer$|^csv-parse(?:\/|$)/;
const zoomPan =
  /^@\/components\/workspace\/file-viewer\/viewers\/zoom-pan-frame$|^react-zoom-pan-pinch$/;
const chatMarkdown =
  /^@\/components\/copilot\/copilot-markdown$|^react-markdown$|^remark-gfm$/;

// Modules on service forms, collections, the workspace browser and the chat
// that reach these dialogs, viewers and the chat's markdown renderer only
// through `next/dynamic` or `import()`: a value import puts them back in those
// routes' initial bundles.
const lazyImporters: [file: string, heavy: RegExp][] = [
  ["components/workspace/workspace-object-selector.tsx", folderPicker],
  ["components/copilot/copilot-composer.tsx", folderPicker],
  ["components/views/collection-selection-actions.tsx", groupDialog],
  ["components/workspace/file-viewer/file-viewer-content.tsx", csvViewer],
  ["components/workspace/file-viewer/viewers/zoomable-image.tsx", zoomPan],
  ["components/copilot/copilot-page.tsx", chatMarkdown],
  ["components/copilot/copilot-panel.tsx", chatMarkdown],
  ["components/copilot/copilot-transcript.tsx", chatMarkdown],
  ["components/copilot/copilot-message.tsx", chatMarkdown],
];

describe("workspace lazy imports", () => {
  it("keep the folder picker, group dialog, CSV viewer, zoom and chat markdown out of the static graph", () => {
    const offenders = lazyImporters.flatMap(([file, heavy]) => {
      const path = resolve(srcDir, file);
      return valueImportsMatching(
        readFileSync(path, "utf8"),
        dirname(path),
        heavy,
      ).map((specifier) => `${file}: ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  it("would catch a static import of each heavy module", () => {
    const viewers = resolve(srcDir, "components/workspace/file-viewer/viewers");
    const imports = (source: string, fromDir: string, heavy: RegExp) =>
      valueImportsMatching(source, fromDir, heavy);

    expect(
      imports(
        'import { WorkspaceFolderPickerDialog } from "@/components/workspace/folder-picker/folder-picker-dialog";',
        resolve(srcDir, "components/workspace"),
        folderPicker,
      ),
    ).toHaveLength(1);
    expect(
      imports(
        'import { SelectionToGroupDialog } from "./selection-to-group-dialog";',
        resolve(srcDir, "components/workspace"),
        groupDialog,
      ),
    ).toHaveLength(1);
    expect(
      imports(
        'import { CsvViewer } from "./viewers/csv-viewer";\nimport { parse } from "csv-parse/sync";',
        resolve(srcDir, "components/workspace/file-viewer"),
        csvViewer,
      ),
    ).toEqual(["./viewers/csv-viewer", "csv-parse/sync"]);
    expect(
      imports(
        'import { TransformWrapper } from "react-zoom-pan-pinch";\nimport { ZoomPanFrame } from "./zoom-pan-frame";',
        viewers,
        zoomPan,
      ),
    ).toEqual(["react-zoom-pan-pinch", "./zoom-pan-frame"]);
    expect(
      imports(
        'import { CopilotMarkdown } from "./copilot-markdown";\nimport Markdown from "react-markdown";',
        resolve(srcDir, "components/copilot"),
        chatMarkdown,
      ),
    ).toEqual(["./copilot-markdown", "react-markdown"]);
    // The lazy wrappers are the sanctioned imports.
    expect(
      imports(
        'import { CopilotMarkdown } from "./copilot-markdown-lazy";',
        resolve(srcDir, "components/copilot"),
        chatMarkdown,
      ),
    ).toEqual([]);
    expect(
      imports(
        'import { WorkspaceFolderPickerDialog } from "@/components/workspace/folder-picker/folder-picker-dialog-lazy";',
        viewers,
        folderPicker,
      ),
    ).toEqual([]);
  });
});
