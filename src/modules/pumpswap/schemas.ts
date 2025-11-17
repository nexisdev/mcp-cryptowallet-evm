import { z } from "zod";

const solMint = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "mint must be a valid Solana address");

export const PumpSwapSchemas = {
  providerSet: z.object({
    quoteEndpoint: z.string().url("quoteEndpoint must be a valid URL").optional(),
    priceEndpoint: z.string().url("priceEndpoint must be a valid URL").optional(),
    tokenEndpoint: z.string().url("tokenEndpoint must be a valid URL").optional(),
    slippageBps: z.number().int().min(1).max(5000).optional(),
  }),
  price: z.object({
    mint: solMint,
  }),
  quote: z.object({
    inputMint: solMint,
    outputMint: solMint,
    amount: z.number().int().min(1, "amount must be specified in lamports"),
    slippageBps: z.number().int().min(1).max(5000).optional(),
  }),
  tokenInfo: z.object({
    mint: solMint,
  }),
};

