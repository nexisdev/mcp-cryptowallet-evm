import { z } from "zod";

export const DebankSchemas = {
  providerSet: z.object({
    endpoint: z.string().url("endpoint must be a valid URL"),
    apiKey: z.string().min(1).optional(),
  }),
  userTotalBalance: z.object({
    address: z
      .string()
      .min(1)
      .regex(/^0x[a-fA-F0-9]{40}$/, "address must be a valid EVM address"),
  }),
  userTokenList: z.object({
    address: z
      .string()
      .min(1)
      .regex(/^0x[a-fA-F0-9]{40}$/, "address must be a valid EVM address"),
  }),
  userProtocolList: z.object({
    address: z
      .string()
      .min(1)
      .regex(/^0x[a-fA-F0-9]{40}$/, "address must be a valid EVM address"),
  }),
  tokenInfo: z.object({
    chainId: z.string().min(1, "chainId is required"),
    tokenAddress: z
      .string()
      .min(1, "tokenAddress is required"),
  }),
};

