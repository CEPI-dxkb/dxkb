export function detailPanelQueryKey(resource: string, id: string) {
  return ["selected-row", resource, id] as const;
}
