import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { extname } from "node:path";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const extractText = async (filePath: string, mimeType: string): Promise<string> => {
  if (mimeType === "application/pdf" || extname(filePath).toLowerCase() === ".pdf") {
    const fileBuffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

    try {
      const parsed = await parser.getText();
      return parsed.text ?? "";
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === DOCX_MIME || extname(filePath).toLowerCase() === ".docx") {
    const parsed = await mammoth.extractRawText({ path: filePath });
    return parsed.value ?? "";
  }

  const fileBuffer = await readFile(filePath);
  return fileBuffer.toString("utf-8");
};
