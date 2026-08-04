import { createServer } from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { createSocketServer } from "./lib/socket.js";
import { startBackgroundJobs } from "./lib/jobs.js";
import { startTradeEngine } from "./lib/trade-engine.js";
const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

const httpServer = createServer(app);

createSocketServer(httpServer);

startBackgroundJobs();

startTradeEngine();

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
