"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroupButton } from "@/components/ui/input-group";
import { shortModelName } from "@/lib/copilot/models";
import { useCopilot } from "./copilot-provider";

/** The model picker, in the composer's toolbar. Opens upward: the composer sits at the bottom. */
export function CopilotModelMenu() {
  const copilot = useCopilot();
  const label = copilot.model
    ? shortModelName(copilot.model)
    : copilot.modelsLoading
      ? "Loading…"
      : "No model";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            type="button"
            size="xs"
            variant="ghost"
            className="min-w-0 shrink"
            aria-label={`Model: ${label}`}
            title="Choose the model"
          >
            <span className="truncate">{label}</span>
            <ChevronDown aria-hidden />
          </InputGroupButton>
        }
      />
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {copilot.models.length === 0 ? (
            <DropdownMenuItem disabled>
              {copilot.modelsLoading
                ? "Loading models…"
                : "No models available"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuRadioGroup
              value={copilot.model ?? ""}
              onValueChange={(value: string) => {
                copilot.setModel(value);
              }}
            >
              {copilot.models.map((model) => (
                <DropdownMenuRadioItem key={model.model} value={model.model}>
                  <span className="truncate">{shortModelName(model.model)}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
