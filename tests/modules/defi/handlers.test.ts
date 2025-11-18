// @ts-nocheck
import { beforeEach, afterEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import { defiToolDefinitions } from "../../../src/modules/defi/index.js";
import * as defiService from "../../../src/modules/defi/service.js";

const createContext = (): Context<Record<string, unknown>> => ({
  client: { version: { protocol: "test" } },
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  reportProgress: jest.fn().mockResolvedValue(undefined),
  streamContent: jest.fn().mockResolvedValue(undefined),
  session: undefined,
  sessionId: "defi-session",
});

const providerConfig = {
  aggregatorUrl: "https://aggregator.example",
  coinGeckoApiKey: "demo-key",
};

const buildAggregatorClient = () => ({
  getSwapPrice: jest.fn().mockResolvedValue({ amount: "100", buyToken: "ETH" }),
  getSwapQuote: jest.fn().mockResolvedValue({ to: "0xrouter", data: "0xdead" }),
  getSupportedChains: jest.fn().mockResolvedValue({ chains: [{ chainId: 1, name: "Ethereum" }] }),
  getLiquiditySources: jest.fn().mockResolvedValue({ sources: [{ id: "uniswap", name: "Uniswap" }] }),
});

const buildCoinGeckoClient = () => ({
  getTokenPrice: jest.fn().mockResolvedValue({ prices: { ETH: { usd: 2000 } } }),
  getNetworks: jest.fn().mockResolvedValue({ data: [{ id: "ethereum" }] }),
  getSupportedDexes: jest.fn().mockResolvedValue({ data: [{ id: "uniswap-v3" }] }),
  getTrendingPools: jest.fn().mockResolvedValue({ pools: [{ id: "eth-usdc" }] }),
});

const sampleArgs: Record<string, any> = {
  defi_provider_set: {
    aggregatorUrl: "https://aggregator-custom.example",
    coinGeckoApiKey: "custom-key",
  },
  defi_provider_info: {},
  defi_swap_price: {
    chainId: 1,
    buyToken: "0xC02aaa39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    sellToken: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    sellAmount: "100000000",
    taker: "0x0000000000000000000000000000000000000001",
  },
  defi_swap_quote: {
    chainId: 1,
    buyToken: "0xC02aaa39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    sellToken: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    sellAmount: "100000000",
    slippageBps: 50,
    taker: "0x0000000000000000000000000000000000000001",
  },
  defi_supported_chains: {},
  defi_liquidity_sources: { chainId: 1 },
  defi_token_price: {
    network: "ethereum",
    addresses: "0xC02aaa39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    includeMarketCap: true,
    include24hVolume: true,
  },
  defi_coingecko_networks: { page: 1 },
  defi_supported_dexes: { network: "ethereum", page: 1 },
  defi_trending_pools: { network: "ethereum", duration: "24h", page: 1 },
  defi_convert_wei_to_unit: { amount: "1000000000000000000", decimals: 18 },
  defi_convert_unit_to_wei: { amount: "1.5", decimals: 6 },
};

let aggregatorClient: ReturnType<typeof buildAggregatorClient>;
let coinGeckoClient: ReturnType<typeof buildCoinGeckoClient>;

beforeEach(() => {
  jest.restoreAllMocks();
  aggregatorClient = buildAggregatorClient();
  coinGeckoClient = buildCoinGeckoClient();

  jest.spyOn(defiService, "setProviderConfig").mockResolvedValue(providerConfig);
  jest.spyOn(defiService, "getProviderConfig").mockResolvedValue(providerConfig);
  jest
    .spyOn(defiService, "createAggregatorClient")
    .mockResolvedValue(aggregatorClient as any);
  jest
    .spyOn(defiService, "createCoinGeckoClient")
    .mockResolvedValue(coinGeckoClient as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("defi module tools", () => {
  test("each tool executes successfully", async () => {
    const context = createContext();

    for (const tool of defiToolDefinitions) {
      const args = sampleArgs[tool.name] ?? {};
      const result = await tool.execute(args, context);
      if (typeof result === "string") {
        expect(result.length).toBeGreaterThan(0);
      } else if (result && typeof result === "object") {
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
      } else {
        throw new Error(`Unexpected tool result for ${tool.name}`);
      }
    }
  });

  test("swap price delegates to aggregator client", async () => {
    const tool = defiToolDefinitions.find((t) => t.name === "defi_swap_price")!;
    const context = createContext();
    await tool.execute(sampleArgs.defi_swap_price, context);
    expect(aggregatorClient.getSwapPrice).toHaveBeenCalledWith(sampleArgs.defi_swap_price);
  });

  test("token price delegates to CoinGecko client", async () => {
    const tool = defiToolDefinitions.find((t) => t.name === "defi_token_price")!;
    const context = createContext();
    await tool.execute(sampleArgs.defi_token_price, context);
    expect(coinGeckoClient.getTokenPrice).toHaveBeenCalledWith(
      sampleArgs.defi_token_price.network,
      sampleArgs.defi_token_price.addresses,
      {
        includeMarketCap: sampleArgs.defi_token_price.includeMarketCap,
        include24hVolume: sampleArgs.defi_token_price.include24hVolume,
      },
    );
  });
});
