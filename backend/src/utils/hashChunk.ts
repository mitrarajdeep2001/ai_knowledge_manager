import { createHash } from "crypto";

export const hashChunk = (chunk: string): string => {
  return createHash("sha256").update(chunk).digest("hex");
};
