export function buildGenomeInClause(ids: string[]): string {
  return ids
    .reduce<string[]>((validIds, id) => {
      const trimmedId = id.trim();
      if (/^\d+(\.\d+)?$/.test(trimmedId)) validIds.push(trimmedId);
      return validIds;
    }, [])
    .join(",");
}
