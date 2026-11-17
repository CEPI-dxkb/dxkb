import { encodePathSegment } from "@/lib/url";

/**
 * The one public folder legacy BV-BRC lists as "BV-BRC Workshop" (its file
 * picker's view dropdown, `WorkspaceObjectSelector.js`). The owner is a legacy
 * `@patricbrc.org` account, so this is a literal, never built from the signed-in
 * user's realm. Kept free of component imports so the navbar can use it.
 */
const workshopOwner = "ARWattam@patricbrc.org";
const workshopFolderName = "BV-BRC Workshop";

export const workshopWorkspacePath = `/${workshopOwner}/${workshopFolderName}`;

/** The workspace browser's read-only public route for the same folder. */
export const workshopBrowserHref = `/workspace/public/${encodePathSegment(workshopOwner)}/${encodePathSegment(workshopFolderName)}`;
