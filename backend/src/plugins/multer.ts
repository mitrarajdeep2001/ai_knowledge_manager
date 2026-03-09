import fp from "fastify-plugin";
import multipart, { type MultipartFile } from "@fastify/multipart";
import { createWriteStream, mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadedDocumentFile {
  originalname: string;
  mimetype: string;
  path: string;
}

const resolveStoragePath = (originalFilename: string): string => {
  const targetDir = resolve(process.env.DOCUMENTS_STORAGE_DIR ?? "storage/documents");
  mkdirSync(targetDir, { recursive: true });

  const extension = extname(originalFilename);
  const safeBase = originalFilename
    .replace(extension, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 80);
  const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  return resolve(targetDir, `${safeBase || "document"}-${suffix}${extension}`);
};

export const persistUploadedFile = async (
  filePart: MultipartFile,
): Promise<UploadedDocumentFile> => {
  const path = resolveStoragePath(filePart.filename);
  await pipeline(filePart.file, createWriteStream(path));

  return {
    originalname: filePart.filename,
    mimetype: filePart.mimetype,
    path,
  };
};

export const multerPlugin = fp(async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: 1,
    },
  });
});
