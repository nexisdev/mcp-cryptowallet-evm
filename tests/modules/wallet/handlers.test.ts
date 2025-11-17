// @ts-nocheck
import { beforeEach, describe, expect, test, jest } from "@jest/globals";
import { Context } from "fastmcp";
import { Wallet, __walletMocks } from "ethers";
import { walletToolDefinitions } from "../../../src/modules/wallet/index.js";
import { __testing } from "../../../src/modules/wallet/utils.js";

jest.mock("@scure/bip39", () => ({
  generateMnemonic: jest.fn().mockReturnValue("test test test test test test test test test test test junk"),
}));

const PRIVATE_KEY =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const sampleArgs: Record<string, any> = {
  wallet_provider_set: { providerURL: "https://eth.llamarpc.com" },
  wallet_create_random: {},
  wallet_from_private_key: { privateKey: PRIVATE_KEY },
  wallet_create_mnemonic_phrase: {},
  wallet_from_mnemonic: {
    mnemonic: "test test test test test test test test test test test junk",
  },
  wallet_from_encrypted_json: {
    json: '{"address":"0xabc"}',
    password: "test",
  },
  wallet_encrypt: {
    wallet: PRIVATE_KEY,
    password: "test",
  },
  wallet_get_address: { wallet: PRIVATE_KEY },
  wallet_get_public_key: { wallet: PRIVATE_KEY },
  wallet_get_private_key: { wallet: PRIVATE_KEY },
  wallet_get_mnemonic: {
    wallet: "test test test test test test test test test test test junk",
  },
  wallet_get_balance: { wallet: PRIVATE_KEY },
  wallet_get_chain_id: { wallet: PRIVATE_KEY },
  wallet_get_gas_price: { wallet: PRIVATE_KEY },
  wallet_get_transaction_count: { wallet: PRIVATE_KEY },
  wallet_call: {
    wallet: PRIVATE_KEY,
    transaction: { to: "0x1111111111111111111111111111111111111111", data: "0x" },
  },
  wallet_send_transaction: {
    wallet: PRIVATE_KEY,
    transaction: { to: "0x1111111111111111111111111111111111111111", value: "0x1" },
  },
  wallet_sign_transaction: {
    wallet: PRIVATE_KEY,
    transaction: { to: "0x1111111111111111111111111111111111111111", value: "0x1" },
  },
  wallet_populate_transaction: {
    wallet: PRIVATE_KEY,
    transaction: { to: "0x1111111111111111111111111111111111111111" },
  },
  wallet_sign_message: {
    wallet: PRIVATE_KEY,
    message: "hello",
  },
  wallet_sign_typed_data: {
    wallet: PRIVATE_KEY,
    domain: { name: "Test", version: "1" },
    types: { Mail: [{ name: "to", type: "address" }] },
    value: { to: "0x1111111111111111111111111111111111111111" },
  },
  wallet_verify_message: {
    message: "hello",
    signature: "0xsignature",
    address: "0xabc",
  },
  wallet_verify_typed_data: {
    domain: { name: "Test" },
    types: { Mail: [{ name: "to", type: "address" }] },
    value: { to: "0x1111111111111111111111111111111111111111" },
    signature: "0xsignature",
    address: "0xabc",
  },
  provider_get_block: {
    blockHashOrBlockTag: "latest",
  },
  provider_get_transaction: {
    transactionHash: "0xtx",
  },
  provider_get_transaction_receipt: {
    transactionHash: "0xtx",
  },
  provider_get_code: {
    address: "0x1111111111111111111111111111111111111111",
  },
  provider_get_storage_at: {
    address: "0x1111111111111111111111111111111111111111",
    position: "0x0",
  },
  provider_estimate_gas: {
    transaction: { to: "0x1111111111111111111111111111111111111111" },
  },
  provider_get_logs: {
    filter: { address: "0x1111111111111111111111111111111111111111" },
  },
  provider_get_ens_resolver: {
    name: "example.eth",
  },
  provider_lookup_address: {
    address: "0x1111111111111111111111111111111111111111",
  },
  provider_resolve_name: {
    name: "example.eth",
  },
  network_get_network: {},
  network_get_block_number: {},
  network_get_fee_data: {},
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
  sessionId: "test-session",
});

beforeEach(() => {
  __testing.resetProviders();
  jest.clearAllMocks();
  process.env.PRIVATE_KEY = PRIVATE_KEY;
});

describe("wallet tool handlers", () => {
  walletToolDefinitions.forEach((tool) => {
    test(`${tool.name} executes successfully`, async () => {
      const args = sampleArgs[tool.name];
      const context = createContext();
      const result = await tool.execute(args, context);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  test("send transaction uses wallet signer", async () => {
    const tool = walletToolDefinitions.find((t) => t.name === "wallet_send_transaction")!;
    const context = createContext();
    await tool.execute(sampleArgs.wallet_send_transaction, context);
    expect(__walletMocks.sendTransaction).toHaveBeenCalled();
  });
});
