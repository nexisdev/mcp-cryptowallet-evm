import type { ServerContext } from "../../server/types.js";
import { DEBANK_DEFAULT_ENDPOINT } from "./constants.js";

type DebankConfig = {
  endpoint: string;
  apiKey?: string;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, DebankConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setDebankConfig = (
  context: ServerContext,
  config: DebankConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getDebankConfig = (
  context: ServerContext,
): DebankConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }
  return {
    endpoint: DEBANK_DEFAULT_ENDPOINT,
    apiKey: process.env.DEBANK_API_KEY,
  };
};

export const resetDebankConfig = (): void => {
  registry.clear();
};
