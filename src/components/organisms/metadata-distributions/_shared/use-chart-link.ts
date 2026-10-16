import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

interface LinkModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/**
 * Follow a chart mark's link as an anchor would: a plain click navigates in
 * place and a modified one (⌘, Ctrl or Shift) opens a new tab. The marks sit
 * under the chart's pointer overlay, so they cannot be anchors themselves.
 */
export function useChartLink() {
  const router = useRouter();

  const follow = (href: string, modifiers?: LinkModifiers) => {
    if (modifiers && (modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey)) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  };

  /** Enter on a focused mark (role="link") follows it, as on an anchor. */
  const linkKeyDown = (href: string | undefined) =>
    href
      ? (event: KeyboardEvent) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          follow(href, event);
        }
      : undefined;

  return { follow, linkKeyDown };
}
