import type { IncomingMessage } from "http";
import { resolveTokenConfig, type AppConfig } from "../core/config.js";
import type { RuntimeDependencies } from "../core/runtime.js";
import type { SessionMetadata, UsageTier } from "./types.js";

const headerValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parseBearer = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value.toLowerCase().startsWith("bearer ")) {
    return value.slice(7).trim();
  }
  return value.trim();
};

const parseTier = (value: string | undefined, fallback: UsageTier): UsageTier => {
  const normalized = value?.toLowerCase();
  if (normalized === "pro" || normalized === "ultra" || normalized === "free") {
    return normalized;
  }
  return fallback;
};

export const createAuthenticator = (
  config: AppConfig,
  runtime: RuntimeDependencies,
) => {
  return (request: IncomingMessage): Promise<SessionMetadata> => {
    const bearer = parseBearer(headerValue(request.headers.authorization));
    const tokenConfig = resolveTokenConfig(config, bearer ?? undefined);

    if (!tokenConfig && config.tokens.length > 0) {
      const error = new Error("Unauthorized: missing or invalid MCP token");
      error.name = "UnauthorizedError";
      throw error;
    }

    const inferredTier = parseTier(
      headerValue(request.headers["x-mcp-usage-tier"]),
      tokenConfig?.tier ?? config.defaultTier,
    );

    return Promise.resolve({
      userId: tokenConfig?.userId ?? headerValue(request.headers["x-mcp-user-id"]),
      organizationId:
        tokenConfig?.organizationId ?? headerValue(request.headers["x-mcp-organization-id"]),
      tier: inferredTier,
      storage: runtime.storage,
      issuedAt: Date.now(),
    });
  };
};
