import type { ServerContext } from "../../server/types.js";
import {
  PUMPSWAP_PRICE_ENDPOINT,
  PUMPSWAP_QUOTE_ENDPOINT,
  PUMPSWAP_TOKEN_ENDPOINT,
} from "./constants.js";

type PumpSwapConfig = {
  quoteEndpoint: string;
  priceEndpoint: string;
  tokenEndpoint: string;
  slippageBps?: number;
};

const DEFAULT_KEY = "__shared__";
const registry = new Map<string, PumpSwapConfig>();

const getSessionKey = (context: ServerContext): string =>
  context.sessionId ?? DEFAULT_KEY;

export const setPumpSwapConfig = (
  context: ServerContext,
  config: PumpSwapConfig,
): void => {
  registry.set(getSessionKey(context), config);
};

export const getPumpSwapConfig = (
  context: ServerContext,
): PumpSwapConfig => {
  const stored = registry.get(getSessionKey(context));
  if (stored) {
    return stored;
  }
  return {
    quoteEndpoint: PUMPSWAP_QUOTE_ENDPOINT,
    priceEndpoint: PUMPSWAP_PRICE_ENDPOINT,
    tokenEndpoint: PUMPSWAP_TOKEN_ENDPOINT,
    slippageBps: parseFloat(process.env.PUMPSWAP_DEFAULT_SLIPPAGE_BPS ?? "50"),
  };
};

export const resetPumpSwapConfig = (): void => {
  registry.clear();
};
