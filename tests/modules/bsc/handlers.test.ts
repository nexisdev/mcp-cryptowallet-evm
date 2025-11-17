// @ts-nocheck
import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { Context } from "fastmcp";
import { __walletMocks, __contractMocks } from "ethers";
import { bscToolDefinitions } from "../../../src/modules/bsc/index.js";
import { __testing } from "../../../src/modules/wallet/utils.js";

const PRIVATE_KEY =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const sampleArgs: Record<string, any> = {
  bsc_provider_set: { providerURL: "https://bsc-dataseed.binance.org" },
  bsc_transfer_native: {
    wallet: PRIVATE_KEY,
    to: "0x1111111111111111111111111111111111111111",
    amount: "0.5",
  },
  bsc_transfer_token: {
    wallet: PRIVATE_KEY,
    tokenAddress: "0x2222222222222222222222222222222222222222",
    to: "0x3333333333333333333333333333333333333333",
    amount: "10",
    decimals: 18,
  },
  bsc_token_balance: {
    owner: "0x3333333333333333333333333333333333333333",
    tokenAddress: "0x2222222222222222222222222222222222222222",
  },
};

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
  sessionId: "bsc-session",
});

beforeEach(() => {
  __testing.resetProviders();
  jest.clearAllMocks();
  process.env.PRIVATE_KEY = PRIVATE_KEY;
});

describe("bsc tool handlers", () => {
  test("provider set returns confirmation", async () => {
    const tool = bscToolDefinitions.find((t) => t.name === "bsc_provider_set")!;
    const context = createContext();
    const output = await tool.execute(sampleArgs.bsc_provider_set, context);
    expect(output).toContain("BSC provider configured");
  });

  test("native transfer uses wallet signer", async () => {
    const tool = bscToolDefinitions.find((t) => t.name === "bsc_transfer_native")!;
    const context = createContext();
    const output = await tool.execute(sampleArgs.bsc_transfer_native, context);
    expect(output).toContain("BSC transfer broadcast");
    expect(__walletMocks.sendTransaction).toHaveBeenCalled();
  });

  test("token transfer calls contract transfer", async () => {
    const tool = bscToolDefinitions.find((t) => t.name === "bsc_transfer_token")!;
    const context = createContext();
    const output = await tool.execute(sampleArgs.bsc_transfer_token, context);
    expect(output).toContain("BEP-20 transfer broadcast");
    expect(__contractMocks.transfer).toHaveBeenCalled();
  });

  test("token balance returns formatted result", async () => {
    const tool = bscToolDefinitions.find((t) => t.name === "bsc_token_balance")!;
    const context = createContext();
    const output = await tool.execute(sampleArgs.bsc_token_balance, context);
    expect(output).toContain("BEP-20 balance");
  });
});
