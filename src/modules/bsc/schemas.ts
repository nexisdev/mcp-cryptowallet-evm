import { z } from "zod";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected EVM address in hex format");

const walletReferenceSchema = z.object({
  wallet: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export const BscSchemas = {
  providerSet: z.object({
    providerURL: z.string().url("providerURL must be a valid URL"),
  }),
  transferNative: walletReferenceSchema.extend({
    to: addressSchema,
    amount: z.string().min(1, "amount is required"),
    gasPrice: z.string().optional(),
  }),
  transferToken: walletReferenceSchema.extend({
    tokenAddress: addressSchema,
    to: addressSchema,
    amount: z.string().min(1, "amount is required"),
    decimals: z.number().int().min(0).max(36).optional(),
    gasPrice: z.string().optional(),
  }),
  tokenBalance: z.object({
    owner: addressSchema,
    tokenAddress: addressSchema,
  }),
};

