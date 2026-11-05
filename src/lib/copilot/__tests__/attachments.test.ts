import {
  copilotAttachmentFields,
  copilotModelFor,
  maxCopilotImageBytes,
  readCopilotAttachment,
} from "../attachments";
import type { CopilotModel } from "../types";

function model(name: string, supportsImage: boolean, isDefault = false): CopilotModel {
  return { model: name, modelType: null, priority: null, maxTokens: null, supportsImage, isDefault };
}

describe("readCopilotAttachment", () => {
  it("reads text files, PDFs and images", async () => {
    const text = await readCopilotAttachment(
      new File([">seq1\nACGT"], "seqs.fasta", { type: "" }),
    );
    expect(text).toEqual({
      attachment: expect.objectContaining({
        kind: "file",
        name: "seqs.fasta",
        content: ">seq1\nACGT",
        mimeType: "text/plain",
      }) as unknown,
    });

    const pdf = await readCopilotAttachment(
      new File(["%PDF-1.4\n…"], "paper.pdf", { type: "" }),
    );
    expect(pdf).toEqual({
      attachment: expect.objectContaining({
        kind: "pdf",
        dataUrl: expect.stringMatching(/^data:application\/pdf;base64,JVBERi0/) as unknown,
      }) as unknown,
    });

    const image = await readCopilotAttachment(
      new File([new Uint8Array([137, 80, 78, 71])], "gel.png", { type: "image/png" }),
    );
    expect(image).toEqual({
      attachment: expect.objectContaining({
        kind: "image",
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/) as unknown,
      }) as unknown,
    });
  });

  it("refuses binary files, fake PDFs, odd images and large images", async () => {
    expect(
      await readCopilotAttachment(new File(["a\0b"], "data.bin", { type: "" })),
    ).toEqual({ error: expect.stringContaining("binary") as unknown });
    expect(
      await readCopilotAttachment(new File(["hello"], "fake.pdf", { type: "application/pdf" })),
    ).toEqual({ error: "fake.pdf is not a PDF file." });
    expect(
      await readCopilotAttachment(new File(["x"], "pic.tiff", { type: "image/tiff" })),
    ).toEqual({ error: expect.stringContaining("PNG, JPEG") as unknown });
    const big = new File([new Uint8Array(maxCopilotImageBytes + 1)], "big.png", {
      type: "image/png",
    });
    expect(await readCopilotAttachment(big)).toEqual({
      error: "big.png is larger than 6 MB.",
    });
  });
});

describe("copilotAttachmentFields", () => {
  it("sorts attachments into the request's fields", () => {
    expect(
      copilotAttachmentFields([
        { id: "1", kind: "image", name: "a.png", size: 1, dataUrl: "data:image/png;base64,AA" },
        { id: "2", kind: "file", name: "b.txt", size: 2, content: "hi", mimeType: "text/plain" },
      ]),
    ).toEqual({
      images: [{ name: "a.png", dataUrl: "data:image/png;base64,AA" }],
      files: [{ name: "b.txt", content: "hi", mimeType: "text/plain", size: 2 }],
    });
    expect(copilotAttachmentFields([])).toEqual({});
  });
});

describe("copilotModelFor", () => {
  const models = [model("text", false), model("vision", true), model("vision-default", true, true)];

  it("keeps the chosen model unless it cannot read the images", () => {
    expect(copilotModelFor(models, "text", false)).toBe("text");
    expect(copilotModelFor(models, "vision", true)).toBe("vision");
    expect(copilotModelFor(models, "text", true)).toBe("vision-default");
    expect(copilotModelFor(models, "unknown", true)).toBe("unknown");
    expect(copilotModelFor([model("text", false)], "text", true)).toBeNull();
  });
});
