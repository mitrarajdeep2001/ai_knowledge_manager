import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pino, { multistream, stdTimeFunctions, type LoggerOptions } from "pino";

type LogMetadata = Record<string, unknown> | Error | undefined;

const logsDir = resolve(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });

const appLogPath = resolve(logsDir, "app.log");
const errorLogPath = resolve(logsDir, "error.log");

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  timestamp: stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
};

export const pinoLogger = pino(
  options,
  multistream([
    { level: "info", stream: pino.destination({ dest: appLogPath, sync: false }) },
    { level: "error", stream: pino.destination({ dest: errorLogPath, sync: false }) },
  ]),
);

const normalizeMetadata = (metadata: LogMetadata): Record<string, unknown> => {
  if (!metadata) {
    return {};
  }

  if (metadata instanceof Error) {
    return { err: metadata };
  }

  const record = { ...metadata };
  const maybeError = record.error;
  if (maybeError instanceof Error) {
    record.err = maybeError;
    delete record.error;
  }

  return record;
};

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    pinoLogger.info(normalizeMetadata(metadata), message);
  },
  warn(message: string, metadata?: LogMetadata): void {
    pinoLogger.warn(normalizeMetadata(metadata), message);
  },
  error(message: string, metadata?: LogMetadata): void {
    pinoLogger.error(normalizeMetadata(metadata), message);
  },
  debug(message: string, metadata?: LogMetadata): void {
    pinoLogger.debug(normalizeMetadata(metadata), message);
  },
};
