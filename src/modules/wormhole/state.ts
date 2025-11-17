import type { ServerContext } from "../../server/types.js";
import { WORMHOLE_DEFAULT_ENDPOINT } from "./constants.js";

type WormholeConfig = {
  endpoint: string;
  apiKey?: string;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, WormholeConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setWormholeConfig = (
  context: ServerContext,
  config: WormholeConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getWormholeConfig = (
  context: ServerContext,
): WormholeConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }

  return {
    endpoint: WORMHOLE_DEFAULT_ENDPOINT,
    apiKey: process.env.WORMHOLE_API_KEY,
  };
};

export const resetWormholeConfig = (): void => {
  registry.clear();
};
