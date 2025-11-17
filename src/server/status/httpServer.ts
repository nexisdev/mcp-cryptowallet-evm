import http from "node:http";
import { URL } from "node:url";

import type { AppLogger } from "../../core/logging.js";

import type { StatusServerConfig } from "./config.js";
import { getStatusMonitor } from "./statusMonitor.js";

type ShutdownHandle = {
  close: () => Promise<void>;
};

const applyCorsHeaders = (
  res: http.ServerResponse,
  config: StatusServerConfig,
): void => {
  if (!config.corsEnabled) {
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", config.corsOrigin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
};

const sendJson = (
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(body);
};

const sendText = (
  res: http.ServerResponse,
  statusCode: number,
  payload: string,
): void => {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(payload);
};

export const startStatusHttpServer = async (
  config: StatusServerConfig,
  logger: AppLogger,
): Promise<ShutdownHandle> => {
  const monitor = getStatusMonitor();

  const server = http.createServer(async (req, res) => {
    applyCorsHeaders(res, config);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET,OPTIONS",
      });
      res.end();
      return;
    }

    const timeout = setTimeout(() => {
      try {
        if (!res.headersSent) {
          res.writeHead(504);
        }
        res.end();
      } catch {
        // ignore
      }
    }, config.requestTimeoutMs);

    try {
      const hostHeader = req.headers.host ?? `${config.host}:${config.port}`;
      const url = new URL(req.url ?? "/", `http://${hostHeader}`);

      if (req.method === "GET" && url.pathname === "/health") {
        await monitor.evaluateDependencies(false);
        sendText(res, 200, "ok");
        return;
      }

      if (req.method === "GET" && url.pathname === "/uptime") {
        const snapshot = monitor.snapshot();
        sendJson(res, 200, {
          startTime: snapshot.service.startTime,
          uptimeSeconds: snapshot.service.uptimeSeconds,
          generatedAt: snapshot.generatedAt,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/status") {
        const refresh = url.searchParams.get("refresh") === "1";
        await monitor.evaluateDependencies(refresh);
        const snapshot = monitor.snapshot();
        sendJson(res, 200, snapshot);
        return;
      }

      sendJson(res, 404, {
        error: "Not Found",
        path: url.pathname,
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "[status] request failed",
      );
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal Server Error" });
      } else {
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(config.port, config.host, () => {
      logger.info(
        {
          host: config.host,
          port: config.port,
        },
        "[status] HTTP server listening",
      );
      resolve();
    });
    server.on("error", (error) => {
      reject(error);
    });
  });

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
};
