import { UserError } from "fastmcp";
import { ethers } from "ethers";
import { formatKeyValue } from "../wallet/utils.js";
import {
  createAggregatorClient,
  createCoinGeckoClient,
  getProviderConfig,
  setProviderConfig,
} from "./service.js";
import { DEFI_NAMESPACE } from "./constants.js";
import type { ProviderSetInput } from "./schemas.js";
import type { ServerContext } from "../../server/types.js";

type FastMCPContext = ServerContext;

const stringify = (payload: unknown): string =>
  JSON.stringify(payload, null, 2);

export const setDefiProviderHandler = async (
  args: ProviderSetInput,
  context: FastMCPContext,
): Promise<string> => {
  const config = await setProviderConfig(context, args);
  return formatKeyValue("DeFi trading provider configured", {
    aggregatorUrl: config.aggregatorUrl,
    coinGeckoApiKey: config.coinGeckoApiKey ? "configured" : "not set",
    namespace: DEFI_NAMESPACE,
  });
};

export const getDefiProviderHandler = async (
  _args: Record<string, never>,
  context: FastMCPContext,
): Promise<string> => {
  const config = await getProviderConfig(context);
  return formatKeyValue("DeFi trading provider", {
    aggregatorUrl: config.aggregatorUrl,
    coinGeckoApiKey: config.coinGeckoApiKey ? "configured" : "not set",
    namespace: DEFI_NAMESPACE,
  });
};

export const getSwapPriceHandler = async (
  args: {
    chainId: number;
    buyToken: string;
    sellToken: string;
    sellAmount: string;
    taker?: string;
  },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createAggregatorClient(context);
  try {
    const data = await client.getSwapPrice(args);
    return [
      formatKeyValue("Swap price preview", {
        chainId: args.chainId,
        buyToken: args.buyToken,
        sellToken: args.sellToken,
        sellAmount: args.sellAmount,
      }),
      "Aggregator response:",
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch swap price: ${message}`);
  }
};

export const getSwapQuoteHandler = async (
  args: {
    chainId: number;
    buyToken: string;
    sellToken: string;
    sellAmount: string;
    taker?: string;
    slippageBps?: number;
  },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createAggregatorClient(context);
  try {
    const data = await client.getSwapQuote(args);
    return [
      formatKeyValue("Executable swap quote", {
        chainId: args.chainId,
        buyToken: args.buyToken,
        sellToken: args.sellToken,
        sellAmount: args.sellAmount,
        slippageBps: args.slippageBps ?? "default",
      }),
      "Quote payload (submit via execute_swap or custom logic):",
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch swap quote: ${message}`);
  }
};

export const getSupportedChainsHandler = async (
  _args: Record<string, never>,
  context: FastMCPContext,
): Promise<string> => {
  const client = await createAggregatorClient(context);
  try {
    const data = await client.getSupportedChains() as {
      chains?: Array<{ chainId: number; name: string }>;
    };
    const lines = (data.chains ?? []).map(
      (chain) => `- ${chain.chainId}: ${chain.name}`,
    );
    return [
      "Aggregator supported chains",
      lines.length ? lines.join("\n") : "No chains returned",
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to list supported chains: ${message}`);
  }
};

export const getLiquiditySourcesHandler = async (
  args: { chainId: number },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createAggregatorClient(context);
  try {
    const data = await client.getLiquiditySources(args.chainId) as {
      sources?: Array<{ id: string; name: string }>;
    };
    const lines = (data.sources ?? []).map(
      (source) => `- ${source.id}: ${source.name}`,
    );
    return [
      `Liquidity sources on chain ${args.chainId}`,
      lines.length ? lines.join("\n") : "No sources reported",
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to load liquidity sources: ${message}`);
  }
};

export const getTokenPriceHandler = async (
  args: {
    network: string;
    addresses: string;
    includeMarketCap?: boolean;
    include24hVolume?: boolean;
  },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createCoinGeckoClient(context);
  try {
    const data = await client.getTokenPrice(args.network, args.addresses, {
      includeMarketCap: args.includeMarketCap,
      include24hVolume: args.include24hVolume,
    });
    return [
      formatKeyValue("CoinGecko token price lookup", {
        network: args.network,
        addresses: args.addresses,
      }),
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch token prices: ${message}`);
  }
};

export const getNetworksHandler = async (
  args: { page?: number },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createCoinGeckoClient(context);
  try {
    const data = await client.getNetworks(args.page);
    return [
      `CoinGecko onchain networks (page ${args.page ?? 1})`,
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch CoinGecko networks: ${message}`);
  }
};

export const getSupportedDexesHandler = async (
  args: { network: string; page?: number },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createCoinGeckoClient(context);
  try {
    const data = await client.getSupportedDexes(args.network, args.page);
    return [
      `DEXes on ${args.network} (page ${args.page ?? 1})`,
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch supported DEXes: ${message}`);
  }
};

export const getTrendingPoolsHandler = async (
  args: { network?: string; duration?: string; page?: number },
  context: FastMCPContext,
): Promise<string> => {
  const client = await createCoinGeckoClient(context);
  try {
    const data = await client.getTrendingPools(args.network, {
      duration: args.duration,
      page: args.page,
    });
    return [
      `Trending pools ${args.network ? `on ${args.network}` : "across networks"}`,
      stringify(data),
    ].join("\n\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to fetch trending pools: ${message}`);
  }
};

export const convertWeiToFormattedHandler = (
  args: { amount: string; decimals: number },
  _context?: unknown,
): string => {
  try {
    const formatted = ethers.utils.formatUnits(args.amount, args.decimals);
    return formatKeyValue("Wei to unit conversion", {
      wei: args.amount,
      decimals: args.decimals,
      value: formatted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to convert wei: ${message}`);
  }
};

export const convertFormattedToWeiHandler = (
  args: { amount: string; decimals: number },
  _context?: unknown,
): string => {
  try {
    const wei = ethers.utils.parseUnits(args.amount, args.decimals).toString();
    return formatKeyValue("Unit to wei conversion", {
      value: args.amount,
      decimals: args.decimals,
      wei,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to convert to wei: ${message}`);
  }
};
