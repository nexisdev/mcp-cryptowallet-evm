import type { ServerContext } from "../../server/types.js";
import { CRYPTOPROJECTS_DEFAULT_ENDPOINT } from "./constants.js";

type CryptoProjectsConfig = {
  endpoint: string;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, CryptoProjectsConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setCryptoProjectsConfig = (
  context: ServerContext,
  config: CryptoProjectsConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getCryptoProjectsConfig = (
  context: ServerContext,
): CryptoProjectsConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }
  return {
    endpoint: CRYPTOPROJECTS_DEFAULT_ENDPOINT,
  };
};

export const resetCryptoProjectsConfig = (): void => {
  registry.clear();
};
