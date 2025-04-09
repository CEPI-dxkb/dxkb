import { OverviewView } from "./overview";
import { TaxonomyView } from "./taxonomy";
import { MoreOptionsView } from "./more-options";
// ... import other views

export const Views = {
  overview: OverviewView,
  taxonomy: TaxonomyView,
  moreOptions: MoreOptionsView,
  // ... add other views
} as const;

export type ViewType = keyof typeof Views;