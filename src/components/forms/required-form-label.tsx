import { FormLabel } from "@/components/ui/form";

export function RequiredFormLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel className="gap-1">
      {children}
      <span className="text-red-500">*</span>
    </FormLabel>
  );
}