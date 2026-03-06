import "dotenv/config";
import { buildApp } from "./app";

const start = async () => {
  const app = await buildApp();

  const port = parseInt(process.env.PORT || "3001", 10);

  try {
    const address = await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`Server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
