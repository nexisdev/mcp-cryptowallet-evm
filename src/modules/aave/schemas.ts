import { z } from "zod";

const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected a valid EVM address");

export const AaveSchemas = {
  providerSet: z.object({
    subgraphUrl: z.string().url().optional(),
    apiKey: z.string().min(8).optional(),
    cacheTtlSeconds: z.number().int().positive().max(86_400).optional(),
  }),
  reserves: z.object({}),
  userData: z.object({
    userAddress: ethereumAddress.describe("EVM address, e.g. 0x..."),
  }),
  userHealth: z.object({
    userAddress: ethereumAddress.describe("EVM address, e.g. 0x..."),
  }),
  analyzeLiquidity: z.object({
    symbol: z.string().min(2).describe("Reserve symbol, e.g. USDC or WETH"),
  }),
};

export type ProviderSetInput = z.infer<typeof AaveSchemas.providerSet>;
export type UserDataInput = z.infer<typeof AaveSchemas.userData>;
export type LiquidityInput = z.infer<typeof AaveSchemas.analyzeLiquidity>;
