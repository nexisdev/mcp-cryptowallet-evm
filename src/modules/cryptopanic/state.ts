import type { ServerContext } from "../../server/types.js";
import { CRYPTOPANIC_DEFAULT_ENDPOINT } from "./constants.js";

type CryptoPanicConfig = {
  endpoint: string;
  apiKey?: string;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, CryptoPanicConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setCryptoPanicConfig = (
  context: ServerContext,
  config: CryptoPanicConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getCryptoPanicConfig = (
  context: ServerContext,
): CryptoPanicConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }
  return {
    endpoint: CRYPTOPANIC_DEFAULT_ENDPOINT,
    apiKey: process.env.CRYPTOPANIC_API_KEY,
  };
};

export const resetCryptoPanicConfig = (): void => {
  registry.clear();
};
