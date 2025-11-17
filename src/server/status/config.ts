import { z } from "zod";

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const StatusServerConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  corsEnabled: z.boolean(),
  corsOrigin: z.string().min(1).optional(),
  dependencyCacheTtlMs: z.number().int().min(1),
  requestTimeoutMs: z.number().int().min(100).max(60_000),
});

export type StatusServerConfig = z.infer<typeof StatusServerConfigSchema>;

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const loadStatusServerConfig = (): StatusServerConfig => {
  const rawConfig = {
    enabled: booleanFromEnv(process.env.STATUS_SERVER_ENABLED, true),
    host: process.env.STATUS_SERVER_HOST ?? "0.0.0.0",
    port: parseNumber(process.env.STATUS_SERVER_PORT, 8090),
    corsEnabled: booleanFromEnv(process.env.STATUS_SERVER_CORS_ENABLED, false),
    corsOrigin: process.env.STATUS_SERVER_CORS_ORIGIN,
    dependencyCacheTtlMs: parseNumber(process.env.STATUS_DEPENDENCY_CACHE_TTL_MS, 15_000),
    requestTimeoutMs: parseNumber(process.env.STATUS_SERVER_TIMEOUT_MS, 5_000),
  };

  const parsed = StatusServerConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(`Invalid status server configuration: ${parsed.error.message}`);
  }
  return parsed.data;
};

