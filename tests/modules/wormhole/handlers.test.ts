// @ts-nocheck
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import { applyToolMiddleware } from "../../../src/core/middleware.js";
import { createResponseCacheMiddleware, __testing as cacheTesting } from "../../../src/core/cache.js";
import {
  bridgeTokenHandler,
  routeStatusHandler,
  setWormholeEndpointHandler,
  supportedRoutesHandler,
  transferStatusHandler,
  listSupportedChainsHandler,
} from "../../../src/modules/wormhole/handlers.js";
import { WORMHOLE_NAMESPACE } from "../../../src/modules/wormhole/constants.js";
import { resetWormholeConfig } from "../../../src/modules/wormhole/state.js";

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
  sessionId: "wormhole-session",
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
  resetWormholeConfig();
  jest.resetAllMocks();
  globalThis.fetch = jest.fn();
});

describe("wormhole handlers", () => {
  test("set endpoint updates namespace provider", async () => {
    const context = createContext();
    const result = await setWormholeEndpointHandler({ endpoint: "https://example.com/api" }, context);
    expect(result).toContain("Wormhole endpoint configured");
  });

  test("bridge token emits final progress", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockJsonResponse({ quoteId: "quote-1", estimatedFee: "0.25", expirySeconds: 120 }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          transferId: "transfer-123",
          status: "pending",
          etaMinutes: 8,
          explorerUrl: "https://wormholescan.com/transfer-123",
        }),
      );

    const context = createContext();
    await setWormholeEndpointHandler({ endpoint: "https://api.testnet.wormhole.com" }, context);
    await bridgeTokenHandler(
      {
        sourceChain: "ethereum",
        targetChain: "bsc",
        tokenAddress: "0x1234",
        amount: "100",
        recipient: "0xabcd",
      },
      context,
    );

    expect(context.reportProgress).toHaveBeenCalledWith({ progress: 100, total: 100 });
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0].toString()).toContain("/v1/quotes");
    expect((globalThis.fetch as jest.Mock).mock.calls[1][0].toString()).toContain("/v1/transfers");
  });

  test("route status uses response cache middleware", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockJsonResponse({ status: "operational", etaMinutes: 6 }),
      );

    let invokeCount = 0;
    const middleware = createResponseCacheMiddleware({
      namespace: `${WORMHOLE_NAMESPACE}:route_status_test`,
      ttlMs: 60_000,
      keyBuilder: ({ args }) => `${args.sourceChain}:${args.targetChain}`,
    });

    const wrapped = applyToolMiddleware(
      "wormhole_route_status",
      async (args, context) => {
        invokeCount += 1;
        return routeStatusHandler(args, context);
      },
      [middleware],
    );

    const context = createContext();
    await setWormholeEndpointHandler({ endpoint: "https://api.testnet.wormhole.com" }, context);
    await wrapped({ sourceChain: "ethereum", targetChain: "bsc" }, context);
    await wrapped({ sourceChain: "ethereum", targetChain: "bsc" }, context);

    expect(invokeCount).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("supported routes caching", async () => {
    (globalThis.fetch as jest.Mock).mockImplementation(() =>
      mockJsonResponse({
        routes: [
          {
            sourceChain: "ethereum",
            targetChain: "bsc",
            token: "USDC",
            bridge: "portal",
          },
        ],
      }),
    );

    const context = createContext();
    await setWormholeEndpointHandler({ endpoint: "https://api.testnet.wormhole.com" }, context);
    const first = await supportedRoutesHandler({}, context);
    const second = await supportedRoutesHandler({}, context);

    expect(first).toEqual(second);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0].toString()).toContain("/v1/routes");
  });

  test("transfer status handler queries API", async () => {
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockJsonResponse({
          transferId: "transfer-123",
          status: "completed",
          etaMinutes: 0,
          explorerUrl: "https://wormholescan.com/transfer-123",
        }),
      );

    const context = createContext();
    await setWormholeEndpointHandler({ endpoint: "https://api.testnet.wormhole.com" }, context);
    const output = await transferStatusHandler({ transferId: "transfer-123" }, context);
    expect(output).toContain("transfer-123");
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0].toString()).toContain(
      "/v1/transfers/transfer-123",
    );
  });

  test("supported chains list includes known networks", async () => {
    const output = await listSupportedChainsHandler();
    expect(output).toContain("ethereum");
    expect(output).toContain("solana");
  });
});
