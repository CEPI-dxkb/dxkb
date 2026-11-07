import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

// Auspice loads this extension through auspice/config.json rather than Node's
// module graph. Keep a static reference so React Doctor can trace it.
if (process.env.REACT_DOCTOR_SCAN) void import("../auspice/navbar.js");

const root = resolve(import.meta.dirname, "..");
const scratch = resolve(root, ".auspice-build");
const cli = resolve(root, "node_modules/auspice/auspice.js");
const publicDir = resolve(root, "public");
const stampPath = resolve(publicDir, ".auspice-build-hash");
const force = process.argv.includes("--force");
const buildInputs = [
  "scripts/build-auspice.mjs",
  "auspice/config.json",
  "auspice/navbar.js",
  "package.json",
  "pnpm-lock.yaml",
];

// Design tokens copied from the host page into the iframe as `--dxkb-<name>`.
// public/auspice-dark.css consumes exactly these; scripts/auspice-shell.test.ts
// fails the build if the two lists drift apart.
const bridgedTokens = [
  "background",
  "foreground",
  "card",
  "popover",
  "popover-foreground",
  "primary",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "font-geist-sans",
];

/**
 * Inline script that mirrors the host document's tokens onto this document.
 *
 * Inline rather than a separate file so it runs before first paint — an
 * external <script> would let a light frame through. Auspice is same-origin,
 * so `parent.document` is readable directly and a MutationObserver on the
 * host's `data-theme` attribute fires across the frame boundary. Opened
 * standalone, `parent === window` and this is a no-op; the stylesheet's
 * var() fallbacks then render stock Auspice.
 */
const themeBridge = `(function(){try{
var host=window.parent;if(host===window)return;
var from=host.document.documentElement,to=document.documentElement;
var names=${JSON.stringify(bridgedTokens)};
function sync(){var s=host.getComputedStyle(from);
for(var i=0;i<names.length;i++){var v=s.getPropertyValue("--"+names[i]).trim();
if(!v)continue;var f=names[i]==="font-geist-sans";
to.style.setProperty("--dxkb-"+(f?"font":names[i]),f?v+", system-ui, sans-serif":v);}
var t=from.getAttribute("data-theme");if(t)to.setAttribute("data-theme",t);}
sync();new host.MutationObserver(sync).observe(from,{attributes:true,attributeFilter:["data-theme","class","style"]});
}catch(e){}})();`;

const hash = createHash("sha256");
for (const input of buildInputs)
  hash.update(readFileSync(resolve(root, input)));
for (const patch of globSync("patches/*auspice*", { cwd: root })) {
  hash.update(readFileSync(resolve(root, patch)));
}
const buildHash = hash.digest("hex");
const outputExists =
  existsSync(resolve(publicDir, "dist")) &&
  existsSync(resolve(publicDir, "nextstrain-viewer.html")) &&
  existsSync(resolve(publicDir, "auspice-favicon.png"));
if (
  !force &&
  outputExists &&
  existsSync(stampPath) &&
  readFileSync(stampPath, "utf8") === buildHash
) {
  console.log("auspice: build inputs unchanged; using existing public output");
  process.exit(0);
}

rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

try {
  execFileSync(
    process.execPath,
    [cli, "build", "--extend", resolve(root, "auspice/config.json")],
    { cwd: scratch, stdio: "inherit" },
  );

  rmSync(stampPath, { force: true });
  rmSync(resolve(publicDir, "dist"), { recursive: true, force: true });
  cpSync(resolve(scratch, "dist"), resolve(publicDir, "dist"), {
    recursive: true,
  });
  for (const artifact of globSync("**/*.{br,gz}", {
    cwd: resolve(publicDir, "dist"),
  })) {
    rmSync(resolve(publicDir, "dist", artifact));
  }
  rmSync(resolve(publicDir, "dist", "index.html"), { force: true });
  cpSync(
    resolve(root, "node_modules/auspice/favicon.png"),
    resolve(publicDir, "auspice-favicon.png"),
  );

  // Auspice minifies its shell, so attribute quotes are optional
  // (`href=/favicon.png`); match both forms.
  const shell = readFileSync(resolve(scratch, "index.html"), "utf8")
    .replaceAll(/href=(["']?)\/favicon\.png\1/g, 'href="/auspice-favicon.png"')
    .replace(
      "</head>",
      `<link rel="stylesheet" href="/auspice-dark.css"><script>${themeBridge}</script></head>`,
    );
  if (!shell.includes("/auspice-dark.css")) {
    throw new Error(
      "auspice: could not inject the theme bridge — the built index.html no longer has a </head>",
    );
  }
  writeFileSync(resolve(publicDir, "nextstrain-viewer.html"), shell);
  writeFileSync(stampPath, buildHash);

  console.log("auspice: built public/dist and public/nextstrain-viewer.html");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
