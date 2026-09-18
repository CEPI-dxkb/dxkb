/** Navigate a same-origin reserved tab without sending a referrer. */
export function navigateReservedTab(reservedWindow: Window, href: string): void {
  const link = reservedWindow.document.createElement("a");
  link.href = href;
  link.target = "_self";
  link.rel = "noreferrer";
  link.click();
}
