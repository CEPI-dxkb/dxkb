import { surveillanceFields } from "@/constants/datafields/surveillance";
import { deriveFieldMetadata } from "@/lib/views/field-metadata";

export const surveillanceMetadata = deriveFieldMetadata(surveillanceFields, {
  resource: "surveillance",
});
