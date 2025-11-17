#!/usr/bin/env node

import { createServer } from "./server/createServer.js";
import { startServer } from "./server/startServer.js";

const main = async (): Promise<void> => {
  const server = await createServer();
  await startServer(server);
};

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[fastmcp] Server failed to start", error);
  process.exitCode = 1;
});
