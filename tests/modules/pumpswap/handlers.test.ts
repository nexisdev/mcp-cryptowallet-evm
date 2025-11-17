// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import {
  getPriceHandler,
  getQuoteHandler,
  getTokenInfoHandler,
  setPumpSwapProviderHandler,
} from "../../../src/modules/pumpswap/handlers.js";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import { PUMPSWAP_NAMESPACE } from "../../../src/modules/pumpswap/constants.js";
import { resetPumpSwapConfig } from "../../../src/modules/pumpswap/state.js";

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
  sessionId: "pumpswap-session",
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
  resetPumpSwapConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("pumpswap handlers", () => {
  test("provider set updates endpoints", async () => {
    const context = createContext();
    const message = await setPumpSwapProviderHandler(
      {
        quoteEndpoint: "https://quote-api.jup.ag",
        priceEndpoint: "https://price.jup.ag",
        tokenEndpoint: "https://tokens.jup.ag",
        slippageBps: 75,
      },
      context,
    );
    expect(message).toContain("slippageBps");
  });

  test("price handler formats response", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        data: {
          So11111111111111111111111111111111111111112: {
            id: "So11111111111111111111111111111111111111112",
            price: 180.12,
            mintSymbol: "SOL",
            vsTokenSymbol: "USDC",
            priceChange24h: 3.5,
          },
        },
      }),
    );

    const context = createContext();
    const result = await getPriceHandler(
      { mint: "So11111111111111111111111111111111111111112" },
      context,
    );
    expect(result).toContain("SOL");
  });

  test("quote handler returns swap summary", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValue(
        mockJsonResponse({
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
          inAmount: 1000000,
          outAmount: 150000,
          otherAmountThreshold: 140000,
          slippageBps: 50,
          priceImpactPct: 0.012,
          routePlan: [
            { swapInfo: { ammKey: "Raydium", label: "Raydium", inputMint: "", outputMint: "" } },
          ],
        }),
      );

    const context = createContext();
    const output = await getQuoteHandler(
      {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
        amount: 1000000,
      },
      context,
    );
    expect(output).toContain("Raydium");
  });

  test("token info handler caches results", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        address: "So11111111111111111111111111111111111111112",
        name: "Solana",
        symbol: "SOL",
        decimals: 9,
        logoURI: "https://tokens.jup.ag/sol.png",
        tags: ["solana", "layer1"],
      }),
    );

    const middleware = createResponseCacheMiddleware({
      namespace: `${PUMPSWAP_NAMESPACE}:pumpswap_token_info`,
      ttlMs: 300_000,
      keyBuilder: ({ args }) => args.mint,
    });

    const wrapped = applyToolMiddleware(
      "pumpswap_token_info",
      async (args, context) => getTokenInfoHandler(args, context),
      [middleware],
    );

    const context = createContext();
    await wrapped({ mint: "So11111111111111111111111111111111111111112" }, context);
    await wrapped({ mint: "So11111111111111111111111111111111111111112" }, context);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

