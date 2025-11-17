// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import {
  getUserProtocolListHandler,
  getUserTokenListHandler,
  getUserTotalBalanceHandler,
  setDebankProviderHandler,
  getTokenInfoHandler,
} from "../../../src/modules/debank/handlers.js";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import { DEBANK_NAMESPACE } from "../../../src/modules/debank/constants.js";
import { resetDebankConfig } from "../../../src/modules/debank/state.js";

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
  sessionId: "debank-session",
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
  resetDebankConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("debank handlers", () => {
  test("provider set stores endpoint and API key", async () => {
    const context = createContext();
    const message = await setDebankProviderHandler(
      { endpoint: "https://api.debank.com", apiKey: "abc" },
      context,
    );
    expect(message).toContain("apiKey: provided");
  });

  test("user total balance renders summary", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        total_usd_value: 1234.56,
        chain_list: [
          { id: "eth", usd_value: 1000 },
          { id: "bsc", usd_value: 234.56 },
        ],
      }),
    );

    const context = createContext();
    await setDebankProviderHandler({ endpoint: "https://openapi.debank.com" }, context);
    const output = await getUserTotalBalanceHandler(
      { address: "0x1111111111111111111111111111111111111111" },
      context,
    );

    expect(output).toContain("Total USD Value");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/user/total_balance"),
      expect.any(Object),
    );
  });

  test("token list caches by address", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValue(
        mockJsonResponse([
          { id: "eth", chain: "eth", symbol: "ETH", amount: 1, price: 2000, usd_value: 2000 },
        ]),
      );

    const middleware = createResponseCacheMiddleware({
      namespace: `${DEBANK_NAMESPACE}:token_list`,
      ttlMs: 30_000,
      keyBuilder: ({ args }) => args.address.toLowerCase(),
    });

    let invokes = 0;
    const wrapped = applyToolMiddleware(
      "debank_user_tokens",
      async (args, context) => {
        invokes += 1;
        return getUserTokenListHandler(args, context);
      },
      [middleware],
    );

    const context = createContext();
    await setDebankProviderHandler({ endpoint: "https://openapi.debank.com" }, context);
    const args = { address: "0x2222222222222222222222222222222222222222" };
    await wrapped(args, context);
    await wrapped(args, context);

    expect(invokes).toBe(1);
  });

  test("protocol list aggregates stats", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse([
        {
          name: "Aave",
          portfolio_item_list: [
            { stats: { net_usd_value: 120 } },
            { stats: { asset_usd_value: 30 } },
          ],
        },
      ]),
    );

    const context = createContext();
    await setDebankProviderHandler({ endpoint: "https://openapi.debank.com" }, context);
    const result = await getUserProtocolListHandler(
      { address: "0x3333333333333333333333333333333333333333" },
      context,
    );
    expect(result).toContain("Aave");
  });

  test("token info formats response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        name: "USD Coin",
        symbol: "USDC",
        price: 1,
        price_24h_change: -0.01,
        market_cap: 30000000000,
        volume_24h: 5000000000,
      }),
    );

    const context = createContext();
    await setDebankProviderHandler({ endpoint: "https://openapi.debank.com" }, context);
    const output = await getTokenInfoHandler(
      { chainId: "eth", tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
      context,
    );

    expect(output).toContain("Token overview");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/token"),
      expect.any(Object),
    );
  });
});

