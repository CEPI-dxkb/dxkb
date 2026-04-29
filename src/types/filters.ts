export interface SelectedFilter {
  field: string;
  value: string | [string, string];
  op: "eq" | "ne" | "gt" | "lt" | "between";
}