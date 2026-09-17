"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  isSearchActionDisabled,
  visibleSearchActions,
  type SearchActionConfig,
  type SearchActionId,
} from "./search-action-policy";

// The action table, the visibility filter and the disabled rule live in
// `search-action-policy.ts`, which the `SearchActionBar` test fake also consumes, so
// the fake cannot offer an interaction this component would have hidden. Re-exported
// here because this module is the action bar's public face for its consumers.
export { notReady, type SearchActionId } from "./search-action-policy";

export interface SearchActionBarProps {
  selectedCount: number;
  searchType: string;
  guideUrl?: string;
  // Per-consumer disable with a tooltip reason. Lets one shared config power both
  // /search and the taxon-view, which disable different subsets of the same
  // taxonomy actions.
  disabledActions?: Partial<Record<SearchActionId, string>>;
  enabledActions?: readonly SearchActionId[];
  loadingActionIds?: SearchActionId[];
  actionPopovers?: Partial<Record<SearchActionId, ReactNode>>;
  onAction?: (actionId: SearchActionId) => void;
}

export function SearchActionBar({
  selectedCount,
  searchType,
  guideUrl,
  disabledActions,
  enabledActions,
  loadingActionIds,
  actionPopovers,
  onAction,
}: SearchActionBarProps) {
  const visibleActions = visibleSearchActions({
    searchType,
    selectedCount,
    hasGuideUrl: Boolean(guideUrl),
  });

  const isDisabled = (action: SearchActionConfig) =>
    isSearchActionDisabled(action, { disabledActions, enabledActions });

  const isLoading = (actionId: SearchActionId) =>
    loadingActionIds?.includes(actionId) ?? false;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {visibleActions.map((action) => {
          const renderKey = action.configKey ?? action.id;
          const Icon = action.icon;
          const showSpinner = isLoading(action.id);
          const disabled = isDisabled(action);
          const tooltipText =
            disabledActions?.[action.id] ?? action.disabledWithTooltip;
          const popoverContent = actionPopovers?.[action.id];
          const actionContent = (
            <>
              {showSpinner ? (
                <Spinner className="size-4 shrink-0" />
              ) : action.letter ? (
                <span className="text-2xl leading-none font-black">
                  {action.letter}
                </span>
              ) : Icon ? (
                <Icon className="size-4 shrink-0" />
              ) : null}
              <span
                className={`wrap-break-words text-center leading-tight font-medium whitespace-normal ${action.labelClassName ?? "text-[9px]"}`}
              >
                {action.label.split("\n").map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </>
          );

          const buttonEl = (
            <Button
              key={renderKey}
              variant="secondary"
              className="h-15 w-full flex-col gap-1 font-normal"
              disabled={disabled || showSpinner}
              onClick={
                popoverContent
                  ? undefined
                  : () => {
                      if (action.id === "guide") {
                        if (guideUrl)
                          window.open(
                            guideUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                      } else {
                        onAction?.(action.id);
                      }
                    }
              }
            >
              {actionContent}
            </Button>
          );

          if (popoverContent && !disabled) {
            return (
              <Popover key={renderKey}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      className="h-15 w-full flex-col gap-1 font-normal"
                      disabled={showSpinner}
                    >
                      {actionContent}
                    </Button>
                  }
                />
                <PopoverContent side="left" align="center">
                  {popoverContent}
                </PopoverContent>
              </Popover>
            );
          }

          return tooltipText && disabled ? (
            <Tooltip key={renderKey}>
              <TooltipTrigger
                render={
                  <span className="inline-flex w-full cursor-not-allowed">
                    {buttonEl}
                  </span>
                }
              />
              <TooltipContent side="left">
                <p>{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            buttonEl
          );
        })}
      </div>
    </TooltipProvider>
  );
}
