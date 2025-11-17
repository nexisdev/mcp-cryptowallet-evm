import type { ServerContext } from "../../server/types.js";
import { WEB3RESEARCH_DEFAULT_ENDPOINT } from "./constants.js";

type Web3ResearchConfig = {
  endpoint: string;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, Web3ResearchConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setWeb3ResearchConfig = (
  context: ServerContext,
  config: Web3ResearchConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getWeb3ResearchConfig = (
  context: ServerContext,
): Web3ResearchConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }
  return {
    endpoint: WEB3RESEARCH_DEFAULT_ENDPOINT,
  };
};

export const resetWeb3ResearchConfig = (): void => {
  registry.clear();
};
