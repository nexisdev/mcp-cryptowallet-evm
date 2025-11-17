import pino, { Logger } from "pino";
import type { Logger as FastMCPLogger } from "fastmcp";

export type AppLogger = Logger & FastMCPLogger;

const DEFAULT_LOG_LEVEL = process.env.LOG_LEVEL ?? (
  process.env.NODE_ENV === "production" ? "info" : "debug"
);

const prettyTransportEnabled = (): boolean => {
  const raw = process.env.LOG_PRETTY ?? "";
  return ["1", "true", "yes"].includes(raw.toLowerCase());
};

export const createLogger = (): AppLogger => {
  const transport = prettyTransportEnabled()
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      }
    : undefined;

  const pinoLogger = pino({
    name: "mcp-cryptowallet-evm",
    level: DEFAULT_LOG_LEVEL,
    redact: {
      paths: ["args.password", "args.privateKey", "args.mnemonic"],
      censor: "[redacted]",
    },
    transport,
  });

  // Adapter to add the `log` method required by FastMCP
  // FastMCP's Logger.log maps to Pino's info level
  const loggerWithLog = pinoLogger as AppLogger;
  (loggerWithLog as { log: (...args: unknown[]) => void }).log = (...args: unknown[]): void => {
    // Pino's info accepts: info(obj, msg) or info(msg)
    // FastMCP typically calls log with a message string
    if (args.length === 0) {
      pinoLogger.info("");
    } else if (args.length === 1 && typeof args[0] === "string") {
      pinoLogger.info(args[0]);
    } else if (args.length === 1 && typeof args[0] === "object") {
      pinoLogger.info(args[0] as Record<string, unknown>, "");
    } else {
      // Multiple args: treat first as object if object, otherwise as message
      const first = args[0];
      if (typeof first === "object" && first !== null) {
        pinoLogger.info(first as Record<string, unknown>, String(args[1] ?? ""));
      } else {
        pinoLogger.info(String(first ?? ""));
      }
    }
  };
  return loggerWithLog;
};
