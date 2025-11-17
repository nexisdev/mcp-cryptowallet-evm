// @ts-nocheck
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Context } from "fastmcp";
import { aaveToolDefinitions } from "../../../src/modules/aave/index.js";
import * as aaveService from "../../../src/modules/aave/service.js";

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
  sessionId: "aave-session",
});

const providerConfig = {
  subgraphUrl: "https://graph.aave.example",
  apiKey: "graph-key",
  cacheTtlMs: 60_000,
};

const reservesResponse = {
  reserves: [
    {
      symbol: "USDC",
      underlyingAsset: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      totalLiquidity: "1000000000000",
      availableLiquidity: "400000000000",
      variableBorrowRate: "30000000000000000000000000",
      liquidityRate: "15000000000000000000000000",
      decimals: "6",
      reserveLiquidationThreshold: "8000",
      reserveLiquidationBonus: "10500",
    },
  ],
};

const userResponse = {
  user: {
    id: "0xabc",
    healthFactor: "1.7500",
    totalCollateralUSD: "2500",
    totalBorrowsUSD: "1000",
  },
  userReserves: [
    {
      reserve: {
        symbol: "USDC",
        decimals: "6",
        underlyingAsset: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      },
      currentATokenBalance: "1000000",
      currentTotalDebt: "200000",
      scaledVariableDebt: "0",
      principalStableDebt: "0",
      usageAsCollateralEnabledOnUser: true,
      lastUpdateTimestamp: "1700000000",
    },
  ],
};

const sampleArgs: Record<string, any> = {
  aave_provider_set: {
    subgraphUrl: "https://graph.custom",
    apiKey: "custom-key",
    cacheTtlSeconds: 120,
  },
  aave_provider_info: {},
  aave_reserves_overview: {},
  aave_analyze_liquidity: { symbol: "usdc" },
  aave_user_positions: { userAddress: "0xabc" },
  aave_user_health: { userAddress: "0xabc" },
  aave_namespace_info: {},
};

let executeGraphQuerySpy: jest.SpiedFunction<typeof aaveService.executeGraphQuery>;

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(aaveService, "setProviderConfig").mockResolvedValue(providerConfig);
  jest.spyOn(aaveService, "getProviderConfig").mockResolvedValue(providerConfig);
  executeGraphQuerySpy = jest
    .spyOn(aaveService, "executeGraphQuery")
    .mockImplementation(async (_context, query: string) => {
      if (query.includes("ReservesSummary")) {
        return reservesResponse as any;
      }
      if (query.includes("UserPositions")) {
        return userResponse as any;
      }
      return {} as any;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("aave module tools", () => {
  test("each tool executes successfully", async () => {
    const context = createContext();

    for (const tool of aaveToolDefinitions) {
      const args = sampleArgs[tool.name] ?? {};
      const result = await tool.execute(args, context);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  test("user health triggers graph query with address", async () => {
    const tool = aaveToolDefinitions.find((t) => t.name === "aave_user_health")!;
    const context = createContext();
    await tool.execute(sampleArgs.aave_user_health, context);
    expect(executeGraphQuerySpy).toHaveBeenCalledWith(
      context,
      expect.stringContaining("UserPositions"),
      { user: sampleArgs.aave_user_health.userAddress.toLowerCase() },
    );
  });
});
