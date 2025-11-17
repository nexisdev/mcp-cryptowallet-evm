// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import {
  getProtocolDetailsHandler,
  getTopProtocolsHandler,
  setCryptoProjectsProviderHandler,
} from "../../../src/modules/cryptoprojects/handlers.js";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import { CRYPTOPROJECTS_NAMESPACE } from "../../../src/modules/cryptoprojects/constants.js";
import { resetCryptoProjectsConfig } from "../../../src/modules/cryptoprojects/state.js";

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
  sessionId: "cryptoprojects-session",
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
  resetCryptoProjectsConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("cryptoprojects handlers", () => {
  test("provider set updates endpoint", async () => {
    const context = createContext();
    const result = await setCryptoProjectsProviderHandler({ endpoint: "https://api.llama.fi" }, context);
    expect(result).toContain("endpoint");
  });

  test("protocol details formats summary", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        name: "Uniswap",
        symbol: "UNI",
        slug: "uniswap",
        tvl: 5000000000,
        chain: "Ethereum",
        category: "DEXes",
        chains: ["Ethereum", "Polygon"],
        change_1h: 0.5,
        change_1d: 2.1,
        change_7d: 5.8,
        url: "https://uniswap.org",
        description: "Decentralized exchange protocol.",
      }),
    );

    const context = createContext();
    await setCryptoProjectsProviderHandler({ endpoint: "https://api.llama.fi" }, context);
    const output = await getProtocolDetailsHandler({ slug: "uniswap" }, context);
    expect(output).toContain("Uniswap");
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0].toString();
    expect(url).toContain("/protocol/uniswap");
  });

  test("top protocols caches by filters", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse([
        { name: "Uniswap", symbol: "UNI", slug: "uniswap", tvl: 5000, chain: "Ethereum", category: "DEXes" },
        { name: "Aave", symbol: "AAVE", slug: "aave", tvl: 7000, chain: "Ethereum", category: "Lending" },
      ]),
    );

    const middleware = createResponseCacheMiddleware({
      namespace: `${CRYPTOPROJECTS_NAMESPACE}:cryptoprojects_top_protocols`,
      ttlMs: 60_000,
      keyBuilder: ({ args }) => JSON.stringify(args ?? {}),
    });

    const wrapped = applyToolMiddleware(
      "cryptoprojects_top_protocols",
      async (args, context) => getTopProtocolsHandler(args, context),
      [middleware],
    );

    const context = createContext();
    await setCryptoProjectsProviderHandler({ endpoint: "https://api.llama.fi" }, context);
    const args = { limit: 5, chains: ["Ethereum"] };
    await wrapped(args, context);
    await wrapped(args, context);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
