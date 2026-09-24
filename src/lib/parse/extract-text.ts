import type { FileKind } from "../types";

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".text", ".csv", ".rtf", ".html", ".htm"];
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function detectFileKind(fileName: string, mimeType = ""): FileKind | null {
  const lower = fileName.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));

  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (extension === ".docx" || mimeType === DOCX_MIME) return "docx";
  if (TEXT_EXTENSIONS.includes(extension) || mimeType.startsWith("text/")) {
    return "text";
  }
  return null;
}

/** Extracts plain text from the supported file formats. */
export async function extractText(
  buffer: Buffer,
  kind: FileKind,
): Promise<string> {
  if (kind === "pdf") {
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;
    if (!extract) throw new Error("The DOCX reader failed to load.");
    const { value } = await extract({ buffer });
    return value;
  }

  const raw = buffer.toString("utf8");
  if (kind === "text" && /^\s*</.test(raw) && /<\/?[a-z][\s\S]*>/i.test(raw)) {
    return raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return raw;
}
