type IdList = Record<string, string[]>;

export interface IdGroupContent extends Record<string, unknown> {
  name?: string;
  id_list: IdList;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function createIdGroupContent(
  name: string,
  idField: string,
  ids: readonly string[],
): IdGroupContent {
  return { name, id_list: { [idField]: uniqueIds(ids) } };
}

/**
 * Older ID groups store their content as base64-encoded JSON; the legacy reader in
 * `src/lib/services/genome.ts` still decodes that representation. Accept it here so
 * such a group can be read and appended to. Throws when `raw` is neither valid
 * base64 nor decodes to JSON, so the caller can report the original parse failure.
 */
function decodeLegacyBase64Json(raw: string): unknown {
  const binary = atob(raw.trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

export function parseIdGroupContent(raw: unknown): IdGroupContent {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      try {
        parsed = decodeLegacyBase64Json(raw);
      } catch {
        throw new Error("Workspace ID group contains invalid JSON content");
      }
    }
  }

  if (!isRecord(parsed) || !isRecord(parsed.id_list)) {
    throw new Error(
      "Workspace ID group content must contain an id_list object",
    );
  }

  const idList: IdList = {};
  for (const [field, ids] of Object.entries(parsed.id_list)) {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      throw new Error(
        `Workspace ID group id_list.${field} must be a string array`,
      );
    }
    idList[field] = uniqueIds(ids);
  }

  return { ...parsed, id_list: idList };
}

export function appendIdGroupContent(
  content: IdGroupContent,
  idField: string,
  ids: readonly string[],
): IdGroupContent {
  return {
    ...content,
    id_list: {
      ...content.id_list,
      [idField]: uniqueIds([...(content.id_list[idField] ?? []), ...ids]),
    },
  };
}
