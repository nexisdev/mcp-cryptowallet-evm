// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import {
  getLatestNewsHandler,
  setCryptoPanicProviderHandler,
} from "../../../src/modules/cryptopanic/handlers.js";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import { CRYPTOPANIC_NAMESPACE } from "../../../src/modules/cryptopanic/constants.js";
import { resetCryptoPanicConfig } from "../../../src/modules/cryptopanic/state.js";

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
  sessionId: "cryptopanic-session",
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
  resetCryptoPanicConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("cryptopanic handlers", () => {
  test("provider set uses provided token", async () => {
    const context = createContext();
    const message = await setCryptoPanicProviderHandler(
      { endpoint: "https://cryptopanic.com", apiKey: "token123" },
      context,
    );
    expect(message).toContain("apiKey: provided");
  });

  test("latest news formats results", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        count: 1,
        results: [
          {
            title: "BTC hits new high",
            url: "https://example.com/btc",
            published_at: "2025-11-17T10:00:00Z",
            source: { title: "Example News", domain: "example.com" },
            currencies: [{ code: "BTC" }],
          },
        ],
      }),
    );

    const context = createContext();
    await setCryptoPanicProviderHandler({ endpoint: "https://cryptopanic.com" }, context);
    const output = await getLatestNewsHandler(
      { kind: "news", publicOnly: true, limit: 5 },
      context,
    );
    expect(output).toContain("BTC hits new high");
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0].toString();
    expect(url).toContain("/api/v1/posts/");
  });

  test("news handler caches repeated queries", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        count: 2,
        results: [
          {
            title: "ETH upgrade scheduled",
            url: "https://example.com/eth",
            published_at: "2025-11-17T09:00:00Z",
            source: { title: "News Desk", domain: "news.com" },
          },
        ],
      }),
    );

    const middleware = createResponseCacheMiddleware({
      namespace: `${CRYPTOPANIC_NAMESPACE}:cryptopanic_latest_news`,
      ttlMs: 30_000,
      keyBuilder: ({ args }) => JSON.stringify(args ?? {}),
    });

    const wrapped = applyToolMiddleware(
      "cryptopanic_latest_news",
      async (args, context) => getLatestNewsHandler(args, context),
      [middleware],
    );

    const context = createContext();
    await setCryptoPanicProviderHandler({ endpoint: "https://cryptopanic.com" }, context);
    const args = { kind: "news" as const, publicOnly: true };
    await wrapped(args, context);
    await wrapped(args, context);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
