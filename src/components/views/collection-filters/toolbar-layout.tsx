"use client";

import { createContext, useContext } from "react";

/**
 * How a `CollectionToolbar`, or a bar standing in for one, sits in its page.
 *
 * - `default`: every collection page's own toolbar row.
 * - `besideViewSwitch`: the row shares its line with a view switch pinned at its start by a
 *   `view-switch-host` ancestor (the Interactions tab's Table|Graph pill). It reserves the
 *   switch's inset on the row (`rowInset`), widens the keyword box for a longer placeholder, and leaves the header's
 *   12px rhythm to the body below (the row's 4px inside plus `mb-2`). A collection's action
 *   error alert follows the row rather than leading it, so the switch never covers it.
 *
 * A context rather than a prop: the Interactions Table's toolbar is built three components down
 * (`ResourceChildCollection` -> `ResourceCollection` -> `ResourceFilterBar`), none of which has
 * any other use for it.
 */
export type CollectionToolbarLayout = "default" | "besideViewSwitch";

interface CollectionToolbarLayoutClasses {
  /** The row's outer box (the `@container`): the space below it. It takes no inset: see `rowInset`. */
  frame: string;
  /**
   * The start the view switch covers, as a margin on the row INSIDE the frame. Not padding on the
   * frame: container queries measure its content box, so an inset there would trip the `@2xl`
   * one-row breakpoint by the switch's width early and wrap the toolbar at 1024-1100px.
   */
  rowInset: string;
  /** The keyword box's width from `@2xl` up, at rest and while focused. */
  keywordWidth: string;
  /**
   * Whether a collection's "Could not complete action" alert follows the toolbar instead of
   * leading the collection. A switch pinned at the top-left of the page would cover an alert
   * above the toolbar.
   */
  actionErrorBelowToolbar: boolean;
}

export const collectionToolbarLayoutClasses: Record<
  CollectionToolbarLayout,
  CollectionToolbarLayoutClasses
> = {
  default: {
    frame: "mb-1 shrink-0",
    rowInset: "",
    keywordWidth: "@2xl:w-44 @2xl:focus-within:w-64",
    actionErrorBelowToolbar: false,
  },
  besideViewSwitch: {
    frame: "mb-2 shrink-0",
    rowInset: "ms-(--view-switch-inset)",
    keywordWidth: "@2xl:w-56 @2xl:focus-within:w-64",
    actionErrorBelowToolbar: true,
  },
};

const CollectionToolbarLayoutContext =
  createContext<CollectionToolbarLayout>("default");

/** Lays out every collection toolbar below it; the Interactions shell wraps its two subviews. */
export const CollectionToolbarLayoutProvider =
  CollectionToolbarLayoutContext.Provider;

export function useCollectionToolbarLayout(): CollectionToolbarLayoutClasses {
  return collectionToolbarLayoutClasses[
    useContext(CollectionToolbarLayoutContext)
  ];
}
