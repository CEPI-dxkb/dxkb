import { redirect } from "next/navigation";
import { workshopBrowserHref } from "@/lib/services/workspace/workshop";

export default function WorkshopPage() {
  redirect(workshopBrowserHref);
}
