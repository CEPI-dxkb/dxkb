/**
 * Maps file extensions to CodeMirror 6 language packages.
 * Languages are dynamically imported so unused packages aren't bundled.
 */

import type { LanguageSupport } from "@codemirror/language";

type LanguageLoader = () => Promise<LanguageSupport>;

const extensionToLanguage: Record<string, LanguageLoader> = {
  ".json": () => import("@codemirror/lang-json").then((m) => m.json()),
  ".xml": () => import("@codemirror/lang-xml").then((m) => m.xml()),
  ".py": () => import("@codemirror/lang-python").then((m) => m.python()),
  ".js": () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript()),
  ".jsx": () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true }),
    ),
  ".ts": () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true }),
    ),
  ".tsx": () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true, typescript: true }),
    ),
  ".html": () => import("@codemirror/lang-html").then((m) => m.html()),
  ".htm": () => import("@codemirror/lang-html").then((m) => m.html()),
  ".css": () => import("@codemirror/lang-css").then((m) => m.css()),
  ".cpp": () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  ".c": () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  ".h": () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  ".java": () => import("@codemirror/lang-java").then((m) => m.java()),
  ".md": () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
};

export async function getLanguageExtension(
  fileName: string,
): Promise<LanguageSupport | null> {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return null;

  const ext = fileName.slice(dot).toLowerCase();
  const loader = extensionToLanguage[ext];
  if (!loader) return null;

  return loader();
}
