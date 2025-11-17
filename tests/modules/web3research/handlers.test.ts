// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import {
  assetDetailsHandler,
  searchAssetsHandler,
  setWeb3ResearchProviderHandler,
  trendingHandler,
} from "../../../src/modules/web3research/handlers.js";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import { WEB3RESEARCH_NAMESPACE } from "../../../src/modules/web3research/constants.js";
import { resetWeb3ResearchConfig } from "../../../src/modules/web3research/state.js";

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
  sessionId: "web3research-session",
});

const mockJsonResponse = (payload: unknown, status = 200) =>
  Promise.resolve({
    ok: true,
    status,
    headers: new Map([["content-type", "application/json"]]),
    json: async () => payload,
  });

beforeEach(() => {
  cacheTesting.reset();
  resetWeb3ResearchConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("web3research handlers", () => {
  test("provider set updates endpoint", async () => {
    const context = createContext();
    const message = await setWeb3ResearchProviderHandler(
      { endpoint: "https://api.coingecko.com" },
      context,
    );
    expect(message).toContain("endpoint");
  });

  test("search assets returns top results", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        coins: [
          { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1, thumb: "", large: "" },
          { id: "ethereum", name: "Ethereum", symbol: "eth", market_cap_rank: 2, thumb: "", large: "" },
        ],
      }),
    );

    const context = createContext();
    await setWeb3ResearchProviderHandler({ endpoint: "https://api.coingecko.com" }, context);
    const output = await searchAssetsHandler({ query: "bit" }, context);
    expect(output).toContain("Bitcoin");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v3/search"),
      expect.any(Object),
    );
  });

  test("asset details formats summary", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        id: "bitcoin",
        name: "Bitcoin",
        symbol: "btc",
        description: { en: "Digital gold." },
        market_data: {
          current_price: { usd: 65000 },
          market_cap: { usd: 1200000000000 },
          price_change_percentage_24h: 2.5,
        },
        image: { large: "https://coingecko.com/bitcoin.png" },
        links: { homepage: ["https://bitcoin.org"] },
      }),
    );

    const context = createContext();
    await setWeb3ResearchProviderHandler({ endpoint: "https://api.coingecko.com" }, context);
    const result = await assetDetailsHandler({ id: "bitcoin", currency: "usd" }, context);
    expect(result).toContain("Bitcoin");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v3/coins/bitcoin"),
      expect.any(Object),
    );
  });

  test("trending handler caches response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        coins: [
          { item: { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1, price_btc: 1, thumb: "", score: 0 } },
        ],
      }),
    );

    const middleware = createResponseCacheMiddleware({
      namespace: `${WEB3RESEARCH_NAMESPACE}:web3research_trending`,
      ttlMs: 120_000,
      keyBuilder: () => "trending",
    });

    const wrapped = applyToolMiddleware(
      "web3research_trending",
      async (_args, context) => trendingHandler({}, context),
      [middleware],
    );

    const context = createContext();
    await setWeb3ResearchProviderHandler({ endpoint: "https://api.coingecko.com" }, context);
    await wrapped({}, context);
    await wrapped({}, context);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

