"use client";

import type { ReactNode, RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { navigateReservedTab } from "@/lib/reserved-tab-navigation";
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

// Re-exported because this module is the action bar's public face; the policy
// lives in `search-action-policy.ts`, shared with the test fake.
export { notReady, type SearchActionId } from "./search-action-policy";

export interface SearchActionBarProps {
  selectedCount: number;
  searchType: string;
  guideUrl?: string;
  disabledActions?: Partial<Record<SearchActionId, string>>;
  enabledActions?: readonly SearchActionId[];
  loadingActionIds?: SearchActionId[];
  actionPopovers?: Partial<Record<SearchActionId, ReactNode>>;
  /**
   * Refs to the buttons that dispatch `onAction`, so a dialog an action opens can
   * hand focus back to its button on close (`finalFocus`). The button is disabled
   * while the action is loading, and Chromium then moves focus to the body, so
   * the dialog has nothing focused to return to.
   */
  actionRefs?: Partial<
    Record<SearchActionId, RefObject<HTMLButtonElement | null>>
  >;
  onAction?: (actionId: SearchActionId) => void;
  onError?: (message: string) => void;
}

export function SearchActionBar({
  selectedCount,
  searchType,
  guideUrl,
  disabledActions,
  enabledActions,
  loadingActionIds,
  actionPopovers,
  actionRefs,
  onAction,
  onError,
}: SearchActionBarProps) {
  const visibleActions = visibleSearchActions({
    searchType,
    selectedCount,
    hasGuideUrl: Boolean(guideUrl),
  });

  // The button's `disabled` covers all three rules, but the structure around it
  // follows the consumer's enablement only, so a mid-flight action keeps its
  // shape.
  const isDisabled = (action: SearchActionConfig) =>
    isSearchActionDisabled(action, {
      disabledActions,
      enabledActions,
      loadingActionIds,
    });

  const isDisabledByConsumer = (action: SearchActionConfig) =>
    isSearchActionDisabled(action, { disabledActions, enabledActions });

  const isLoading = (actionId: SearchActionId) =>
    loadingActionIds?.includes(actionId) ?? false;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1 max-md:flex-row">
        {visibleActions.map((action) => {
          const renderKey = action.configKey ?? action.id;
          const Icon = action.icon;
          const showSpinner = isLoading(action.id);
          const disabled = isDisabled(action);
          const disabledByConsumer = isDisabledByConsumer(action);
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
                className={`text-center leading-tight font-medium wrap-break-word whitespace-normal ${action.labelClassName ?? "text-[9px]"}`}
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
              ref={actionRefs?.[action.id]}
              variant="secondary"
              size="tile"
              className="w-full max-md:w-16 max-md:shrink-0"
              disabled={disabled}
              onClick={
                popoverContent
                  ? undefined
                  : () => {
                      if (action.id === "guide") {
                        if (guideUrl) {
                          const guideWindow = window.open(
                            "about:blank",
                            "_blank",
                          );
                          if (!guideWindow) {
                            const message = "Allow pop-ups to open the user guide.";
                            if (onError) onError(message);
                            else toast.error(message);
                            return;
                          }
                          guideWindow.opener = null;
                          navigateReservedTab(guideWindow, guideUrl);
                        }
                      } else {
                        onAction?.(action.id);
                      }
                    }
              }
            >
              {actionContent}
            </Button>
          );

          if (popoverContent && !disabledByConsumer) {
            return (
              <Popover key={renderKey}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="tile"
                      className="w-full max-md:w-16 max-md:shrink-0"
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

          return tooltipText && disabledByConsumer ? (
            <Tooltip key={renderKey}>
              <TooltipTrigger
                render={
                  <span className="inline-flex w-full cursor-not-allowed max-md:w-16 max-md:shrink-0">
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
