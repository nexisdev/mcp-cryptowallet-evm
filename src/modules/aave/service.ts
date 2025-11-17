import { UserError } from "fastmcp";
import {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_SUBGRAPH_URL,
  AAVE_NAMESPACE,
} from "./constants.js";
import { getSessionData, setSessionData } from "../../core/sessionStore.js";
import type { ProviderSetInput } from "./schemas.js";
import type { ServerContext } from "../../server/types.js";

type RuntimeContext = ServerContext;

const CONFIG_KEY = "provider";

export type AaveProviderConfig = {
  subgraphUrl: string;
  apiKey?: string;
  cacheTtlMs: number;
};

const resolveDefaultConfig = (): AaveProviderConfig => ({
  subgraphUrl: DEFAULT_SUBGRAPH_URL,
  apiKey: process.env.THEGRAPH_API_KEY,
  cacheTtlMs: DEFAULT_CACHE_TTL_MS,
});

export const getProviderConfig = async (
  context: RuntimeContext,
): Promise<AaveProviderConfig> => {
  const stored = await getSessionData<AaveProviderConfig>(
    context,
    AAVE_NAMESPACE,
    CONFIG_KEY,
  );
  return stored ?? resolveDefaultConfig();
};

export const setProviderConfig = async (
  context: RuntimeContext,
  input: ProviderSetInput,
): Promise<AaveProviderConfig> => {
  const existing = await getProviderConfig(context);
  const next: AaveProviderConfig = {
    subgraphUrl: input.subgraphUrl ?? existing.subgraphUrl,
    apiKey: input.apiKey ?? existing.apiKey,
    cacheTtlMs: input.cacheTtlSeconds
      ? input.cacheTtlSeconds * 1000
      : existing.cacheTtlMs,
  };

  await setSessionData(context, AAVE_NAMESPACE, CONFIG_KEY, next);
  return next;
};

type GraphResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export const executeGraphQuery = async <TResult>(
  context: RuntimeContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<TResult> => {
  const config = await getProviderConfig(context);

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  const apiKey = config.apiKey ?? process.env.THEGRAPH_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(config.subgraphUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to reach Aave subgraph endpoint: ${message}`);
  });

  if (!response.ok) {
    const body = await response.text();
    throw new UserError(
      `Aave subgraph returned HTTP ${response.status}: ${body.slice(0, 256)}`,
    );
  }

  const payload = (await response.json()) as GraphResponse<TResult>;

  if (payload.errors?.length) {
    throw new UserError(
      `Aave subgraph error: ${payload.errors.map((item) => item.message).join(", ")}`,
    );
  }

  if (!payload.data) {
    throw new UserError("Aave subgraph response did not include data.");
  }

  return payload.data;
};
