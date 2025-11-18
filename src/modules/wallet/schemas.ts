import { z } from "zod";

const hexString = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, "Expected hex-encoded string")
  .describe("Hexadecimal string");

const blockTagSchema = z
  .union([z.string(), z.number()])
  .describe("Block tag (number, hex, or keyword)");

const bigNumberishSchema = z
  .union([z.string(), z.number(), hexString])
  .describe("BigNumberish value");

const walletReferenceSchema = z.object({
  wallet: z.string().trim().min(1, "Wallet reference cannot be empty").optional(),
  password: z.string().min(1, "Password cannot be empty").optional(),
});

const transactionRequestSchema = z
  .object({
    to: z.string().optional(),
    from: z.string().optional(),
    data: hexString.optional(),
    value: bigNumberishSchema.optional(),
    gasLimit: bigNumberishSchema.optional(),
    gasPrice: bigNumberishSchema.optional(),
    maxFeePerGas: bigNumberishSchema.optional(),
    maxPriorityFeePerGas: bigNumberishSchema.optional(),
    nonce: bigNumberishSchema.optional(),
    chainId: z.union([z.number(), z.string()]).optional(),
    type: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()
  .describe("Ethers.js transaction request object");

const typedDataDomainSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .describe("EIP-712 domain object");

const typedDataTypesSchema = z
  .record(
    z.string(),
    z.array(
      z.object({
        name: z.string(),
        type: z.string(),
      }),
    ),
  )
  .describe("EIP-712 types definition");

const typedDataValueSchema = z
  .record(z.string(), z.unknown())
  .describe("EIP-712 message value");

const filterSchema = z
  .object({
    address: z.union([z.string(), z.array(z.string())]).optional(),
    topics: z
      .array(z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))]))
      .optional(),
    fromBlock: blockTagSchema.optional(),
    toBlock: blockTagSchema.optional(),
  })
  .passthrough()
  .describe("Ethers.js log filter");

export const WalletSchemas = {
  providerSet: z.object({
    providerURL: z.string().min(1, "providerURL is required"),
  }),
  createRandom: z.object({
    password: z.string().min(1).optional(),
    path: z.string().optional(),
    locale: z.string().optional(),
  }),
  fromPrivateKey: z.object({
    privateKey: hexString.describe("Hex encoded private key"),
  }),
  createMnemonicPhrase: z.object({
    locale: z.string().optional(),
    length: z
      .union([z.literal(12), z.literal(15), z.literal(18), z.literal(21), z.literal(24)])
      .optional(),
  }),
  fromMnemonic: z.object({
    mnemonic: z.string().min(1, "Mnemonic is required"),
    path: z.string().optional(),
    locale: z.string().optional(),
  }),
  fromEncryptedJson: z.object({
    json: z.string().min(1, "Encrypted JSON is required"),
    password: z.string().min(1, "Password is required"),
  }),
  encryptWallet: walletReferenceSchema.extend({
    password: z.string().min(1, "Password is required"),
    options: z.record(z.unknown()).optional(),
  }),
  walletOnly: walletReferenceSchema,
  walletWithBlockTag: walletReferenceSchema.extend({
    blockTag: blockTagSchema.optional(),
  }),
  walletTransaction: walletReferenceSchema.extend({
    transaction: transactionRequestSchema,
    blockTag: blockTagSchema.optional(),
  }),
  walletMessage: walletReferenceSchema.extend({
    message: z.string().min(1, "Message is required"),
  }),
  walletTypedData: walletReferenceSchema.extend({
    domain: typedDataDomainSchema,
    types: typedDataTypesSchema,
    value: typedDataValueSchema,
  }),
  verifyMessage: z.object({
    message: z.string().min(1, "Message is required"),
    signature: hexString,
    address: z.string().min(1, "Address is required"),
  }),
  verifyTypedData: z.object({
    domain: typedDataDomainSchema,
    types: typedDataTypesSchema,
    value: typedDataValueSchema,
    signature: hexString,
    address: z.string().min(1, "Address is required"),
  }),
  providerBlock: z.object({
    blockHashOrBlockTag: blockTagSchema,
    includeTransactions: z.boolean().optional(),
  }),
  providerTransactionHash: z.object({
    transactionHash: hexString.or(z.string().min(1)),
  }),
  providerCode: z.object({
    address: z.string().min(1),
    blockTag: blockTagSchema.optional(),
  }),
  providerStorage: z.object({
    address: z.string().min(1),
    position: bigNumberishSchema,
    blockTag: blockTagSchema.optional(),
  }),
  providerFilter: z.object({
    filter: filterSchema,
  }),
  providerEstimateGas: z.object({
    transaction: transactionRequestSchema,
  }),
  ensName: z.object({
    name: z.string().min(1),
  }),
  ensAddress: z.object({
    address: z.string().min(1),
  }),
  noArgs: z.object({}).strict(),
  bridgeAssets: walletReferenceSchema.extend({
    from: z.string().min(1).optional(),
    chainId: z.number().int().nonnegative(),
    toChainId: z.number().int().nonnegative(),
    toAddress: z.string().min(1),
    token: z.string().min(1).optional(),
    amount: z.string().min(1),
    minAmountOut: z.string().min(1).optional(),
    slippageBps: z.number().int().min(0).max(10_000).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  swapTokens: walletReferenceSchema.extend({
    from: z.string().min(1).optional(),
    chainId: z.number().int().nonnegative(),
    tokenIn: z.string().min(1),
    tokenOut: z.string().min(1),
    amountIn: z.string().min(1),
    minAmountOut: z.string().min(1).optional(),
    slippageBps: z.number().int().min(0).max(10_000).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
};
