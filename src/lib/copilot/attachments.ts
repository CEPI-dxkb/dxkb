import type { CopilotChatRequest, CopilotModel } from "./types";

export const maxCopilotAttachments = 3;
export const maxCopilotImageBytes = 6 * 1024 * 1024;
export const maxCopilotFileBytes = 10 * 1024 * 1024;

export type CopilotAttachment =
  | { id: string; kind: "image"; name: string; size: number; dataUrl: string }
  | { id: string; kind: "pdf"; name: string; size: number; dataUrl: string }
  | {
      id: string;
      kind: "file";
      name: string;
      size: number;
      content: string;
      mimeType: string;
    };

export const copilotAttachmentAccept = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/*",
  ".txt,.csv,.tsv,.json,.md,.xml,.yaml,.yml,.log",
  ".fasta,.fa,.fna,.faa,.ffn,.fastq,.fq,.gb,.gbk,.gff,.gff3,.gtf,.vcf,.bed",
  ".nwk,.newick,.tre,.tree,.phy,.aln,.sam",
].join(",");

const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function megabytes(bytes: number): string {
  return `${String(Math.round(bytes / (1024 * 1024)))} MB`;
}

function readAs(file: Blob, as: "text" | "dataUrl"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("The file could not be read."));
    };
    if (as === "text") reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

const imageExtensions: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

function imageTypeOf(file: File): string | null {
  if (imageTypes.has(file.type)) return file.type;
  if (file.type !== "") return null;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return Object.hasOwn(imageExtensions, extension) ? imageExtensions[extension] : null;
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Images up to 6 MB; PDFs and text files up to 10 MB. A "PDF" must start with `%PDF-`; a text file
 * must not hold a null byte.
 */
export async function readCopilotAttachment(
  file: File,
): Promise<{ attachment: CopilotAttachment } | { error: string }> {
  const id = crypto.randomUUID();
  const name = file.name.trim() || "attachment";

  const imageType = imageTypeOf(file);
  if (file.type.startsWith("image/") || imageType) {
    if (!imageType) {
      return { error: `${name}: only PNG, JPEG, GIF and WebP images can be attached.` };
    }
    if (file.size > maxCopilotImageBytes) {
      return { error: `${name} is larger than ${megabytes(maxCopilotImageBytes)}.` };
    }
    const raw = await readAs(file, "dataUrl");
    // Some browsers label an image without its type; the gateway wants it named.
    const dataUrl = raw.replace(/^data:[^;,]*;base64,/, `data:${imageType};base64,`);
    return { attachment: { id, kind: "image", name, size: file.size, dataUrl } };
  }

  if (file.size > maxCopilotFileBytes) {
    return { error: `${name} is larger than ${megabytes(maxCopilotFileBytes)}.` };
  }

  if (isPdf(file)) {
    const head = await readAs(file.slice(0, 5), "text");
    if (!head.startsWith("%PDF-")) {
      return { error: `${name} is not a PDF file.` };
    }
    const raw = await readAs(file, "dataUrl");
    // Some browsers label a PDF without its type; the gateway wants it named.
    const dataUrl = raw.replace(/^data:[^;,]*;base64,/, "data:application/pdf;base64,");
    return { attachment: { id, kind: "pdf", name, size: file.size, dataUrl } };
  }

  const content = await readAs(file, "text");
  if (content.includes("\0")) {
    return {
      error: `${name} looks like a binary file. Attach text files, PDFs or images.`,
    };
  }
  return {
    attachment: {
      id,
      kind: "file",
      name,
      size: file.size,
      content,
      mimeType: file.type || "text/plain",
    },
  };
}

export function copilotAttachmentFields(
  attachments: CopilotAttachment[],
): Pick<CopilotChatRequest, "images" | "files" | "pdfs"> {
  const images: NonNullable<CopilotChatRequest["images"]> = [];
  const files: NonNullable<CopilotChatRequest["files"]> = [];
  const pdfs: NonNullable<CopilotChatRequest["pdfs"]> = [];
  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      images.push({ name: attachment.name, dataUrl: attachment.dataUrl });
    } else if (attachment.kind === "pdf") {
      pdfs.push({ name: attachment.name, dataUrl: attachment.dataUrl, size: attachment.size });
    } else {
      files.push({
        name: attachment.name,
        content: attachment.content,
        mimeType: attachment.mimeType,
        size: attachment.size,
      });
    }
  }
  return {
    ...(images.length > 0 ? { images } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(pdfs.length > 0 ? { pdfs } : {}),
  };
}

export function copilotModelFor(
  models: CopilotModel[],
  chosen: string,
  hasImages: boolean,
): string | null {
  if (!hasImages) return chosen;
  const current = models.find((model) => model.model === chosen);
  // An unknown model is trusted, as BV-BRC does.
  if (!current || current.supportsImage) return chosen;
  const readers = models.filter((model) => model.supportsImage);
  return (readers.find((model) => model.isDefault) ?? readers.at(0))?.model ?? null;
}

export const attachmentOnlyQuery = "Please look at the attached file.";
