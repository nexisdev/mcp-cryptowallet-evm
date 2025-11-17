import { getSessionData, setSessionData } from "../../core/sessionStore.js";
import { DEFI_NAMESPACE, DEFAULT_AGGREGATOR_URL, DEFAULT_COINGECKO_API_KEY } from "./constants.js";
import type { ProviderSetInput } from "./schemas.js";
import { AggregatorClient } from "./services/aggregator.js";
import { CoinGeckoClient } from "./services/coingecko.js";
import type { ServerContext } from "../../server/types.js";

type RuntimeContext = ServerContext;

const CONFIG_KEY = "provider";

export type DefiProviderConfig = {
  aggregatorUrl: string;
  coinGeckoApiKey?: string;
};

const defaultConfig: DefiProviderConfig = {
  aggregatorUrl: DEFAULT_AGGREGATOR_URL,
  coinGeckoApiKey: DEFAULT_COINGECKO_API_KEY,
};

export const getProviderConfig = async (
  context: RuntimeContext,
): Promise<DefiProviderConfig> => {
  const stored = await getSessionData<DefiProviderConfig>(
    context,
    DEFI_NAMESPACE,
    CONFIG_KEY,
  );
  return stored ?? defaultConfig;
};

export const setProviderConfig = async (
  context: RuntimeContext,
  input: ProviderSetInput,
): Promise<DefiProviderConfig> => {
  const current = await getProviderConfig(context);
  const next: DefiProviderConfig = {
    aggregatorUrl: input.aggregatorUrl ?? current.aggregatorUrl,
    coinGeckoApiKey: input.coinGeckoApiKey ?? current.coinGeckoApiKey,
  };

  await setSessionData(context, DEFI_NAMESPACE, CONFIG_KEY, next);
  return next;
};

export const createAggregatorClient = async (
  context: RuntimeContext,
): Promise<AggregatorClient> => {
  const config = await getProviderConfig(context);
  return new AggregatorClient(config.aggregatorUrl);
};

export const createCoinGeckoClient = async (
  context: RuntimeContext,
): Promise<CoinGeckoClient> => {
  const config = await getProviderConfig(context);
  return new CoinGeckoClient(config.coinGeckoApiKey);
};
