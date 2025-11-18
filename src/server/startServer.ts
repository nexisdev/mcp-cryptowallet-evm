import { FastMCP } from "fastmcp";
import { getRuntime } from "../core/runtime.js";
import { loadConfig } from "../core/config.js";
import { loadStatusServerConfig } from "./status/config.js";
import { startStatusHttpServer } from "./status/httpServer.js";
import { getStatusMonitor } from "./status/statusMonitor.js";
import type { SessionMetadata } from "./types.js";

const asBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes"].includes(value.toLowerCase());
};

export const startServer = async (server: FastMCP<SessionMetadata>): Promise<void> => {
  const transport = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();
  const { logger } = getRuntime();
  const config = loadConfig();
  const statusConfig = loadStatusServerConfig();

  const monitor = getStatusMonitor();
  monitor.updateDependencyCacheTtl(statusConfig.dependencyCacheTtlMs);
  try {
    await monitor.evaluateDependencies(true);
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "[status] initial dependency evaluation failed",
    );
  }

  let statusServerHandle:
    | Awaited<ReturnType<typeof startStatusHttpServer>>
    | null = null;
  if (statusConfig.enabled) {
    statusServerHandle = await startStatusHttpServer(statusConfig, logger);

    const gracefulShutdown = (): void => {
      void (async (): Promise<void> => {
        if (statusServerHandle) {
          try {
            await statusServerHandle.close();
            logger.info("[status] HTTP server stopped");
          } catch (error) {
            logger.error(
              {
                error: error instanceof Error ? error.message : String(error),
              },
              "[status] failed to stop HTTP server",
            );
          }
          statusServerHandle = null;
        }
      })();
    };

    process.once("SIGTERM", gracefulShutdown);
    process.once("SIGINT", gracefulShutdown);
  }

  const normalizedTransport: "stdio" | "httpStream" = (() => {
    switch (transport) {
      case "http":
      case "httpstream":
      case "http-stream":
      case "stream":
        return "httpStream";
      case "stdio":
      case "pipe":
      case "stdio-stream":
        return "stdio";
      default:
        logger.warn(
          {
            value: transport,
          },
          "[fastmcp] unsupported MCP_TRANSPORT value, defaulting to stdio",
        );
        return "stdio";
    }
  })();

  if (normalizedTransport === "httpStream") {
    if (!config.transport.allowHttp) {
      throw new Error("HTTP transport is disabled by configuration (MCP_ALLOW_HTTP=false)");
    }

    const port = Number.parseInt(process.env.PORT ?? "8080", 10);
    const host = process.env.HOST ?? "0.0.0.0";
    const rawEndpoint = process.env.MCP_HTTP_ENDPOINT ?? "/mcp";
    const normalizedEndpoint = rawEndpoint.startsWith("/")
      ? rawEndpoint
      : `/${rawEndpoint}`;
    const endpoint = normalizedEndpoint as `/${string}`;
    const stateless = asBoolean(process.env.FASTMCP_STATELESS);

    const enableJsonResponse = asBoolean(process.env.MCP_HTTP_JSON_RESPONSE);

    await server.start({
      transportType: "httpStream",
      httpStream: {
        host,
        port,
        endpoint,
        stateless,
        enableJsonResponse,
      },
    });

    logger.info({
      host,
      port,
      endpoint,
      stateless,
      enableJsonResponse,
    }, "[fastmcp] HTTP Stream transport ready");

    return;
  }

  if (normalizedTransport !== "stdio") {
    logger.warn(
      {
        value: transport,
      },
      "[fastmcp] falling back to stdio transport",
    );
  }

  if (!config.transport.allowStdio) {
    throw new Error("STDIO transport is disabled by configuration (MCP_ALLOW_STDIO=false)");
  }

  await server.start({
    transportType: "stdio",
  });

  logger.info("[fastmcp] STDIO transport ready");
};
