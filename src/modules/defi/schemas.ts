import { z } from "zod";

const address = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected a valid contract address");

const positiveInteger = z.number().int().positive();

export const DefiSchemas = {
  providerSet: z.object({
    aggregatorUrl: z.string().url().optional(),
    coinGeckoApiKey: z.string().min(8).optional(),
  }),
  providerInfo: z.object({}),
  swapPrice: z.object({
    chainId: positiveInteger,
    buyToken: address,
    sellToken: address,
    sellAmount: z.string().regex(/^\d+$/, "Expected sellAmount in base units"),
    taker: address.optional(),
  }),
  swapQuote: z.object({
    chainId: positiveInteger,
    buyToken: address,
    sellToken: address,
    sellAmount: z.string().regex(/^\d+$/, "Expected sellAmount in base units"),
    taker: address.optional(),
    slippageBps: z.number().int().positive().max(10_000).optional(),
  }),
  supportedChains: z.object({}),
  liquiditySources: z.object({
    chainId: positiveInteger,
  }),
  tokenPrice: z.object({
    network: z
      .string()
      .min(2)
      .describe("CoinGecko onchain network identifier, e.g. ethereum"),
    addresses: z
      .string()
      .regex(
        /^0x[a-fA-F0-9]{40}(,0x[a-fA-F0-9]{40})*$/,
        "Provide one or more contract addresses separated by commas",
      ),
    includeMarketCap: z.boolean().optional(),
    include24hVolume: z.boolean().optional(),
  }),
  networks: z.object({
    page: z.number().int().positive().max(50).optional(),
  }),
  supportedDexes: z.object({
    network: z.string().min(2),
    page: z.number().int().positive().max(50).optional(),
  }),
  trendingPools: z.object({
    network: z.string().min(2).optional(),
    duration: z.enum(["24h", "7d", "30d"]).optional(),
    page: z.number().int().positive().max(25).optional(),
  }),
  weiToUnit: z.object({
    amount: z.string().regex(/^\d+$/, "Amount must be in wei"),
    decimals: z.number().int().min(0).max(36).default(18),
  }),
  unitToWei: z.object({
    amount: z
      .string()
      .regex(
        /^\d+(\.\d+)?$/,
        "Amount must be a decimal string (e.g., 1.23)",
      ),
    decimals: z.number().int().min(0).max(36).default(18),
  }),
};

export type ProviderSetInput = z.infer<typeof DefiSchemas.providerSet>;
