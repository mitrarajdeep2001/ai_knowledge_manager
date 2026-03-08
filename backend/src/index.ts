import "dotenv/config";
import { buildApp } from "./app";
import { logger } from "./utils/logger";

const start = async () => {
  const app = await buildApp();
  const port = parseInt(process.env.PORT || "3001", 10);

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { module: "process", err: error });
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
      module: "process",
      err: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });

  try {
    const address = await app.listen({ port, host: "0.0.0.0" });
    logger.info("Server listening", { address, port, module: "bootstrap" });
  } catch (error) {
    logger.error("Failed to start server", {
      module: "bootstrap",
      err: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
};

start();
