type IdList = Record<string, string[]>;

export interface IdGroupContent extends Record<string, unknown> {
  name?: string;
  id_list: IdList;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function createIdGroupContent(
  name: string,
  idField: string,
  ids: readonly string[],
): IdGroupContent {
  return { name, id_list: { [idField]: uniqueIds(ids) } };
}

export function parseIdGroupContent(raw: unknown): IdGroupContent {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("Workspace ID group contains invalid JSON content");
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
