import fp from "fastify-plugin";
import multer from "fastify-multer";
import type { Multer } from "multer";
import { mkdirSync } from "node:fs";
import { extname } from "node:path";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const targetDir = process.env.DOCUMENTS_STORAGE_DIR ?? "storage/documents";
    mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(extname(file.originalname), "")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeBase || "document"}-${suffix}${extname(file.originalname)}`);
  },
});

export const upload: Multer = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
}) as unknown as Multer;

export const multerPlugin = fp(async (fastify) => {
  fastify.register(multer.contentParser);
});
