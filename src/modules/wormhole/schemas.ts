import { z } from "zod";
import { WORMHOLE_SUPPORTED_CHAINS } from "./constants.js";

const chainIdEnum = z.enum(WORMHOLE_SUPPORTED_CHAINS.map((chain) => chain.id) as [string, ...string[]]);

export const WormholeSchemas = {
  providerSet: z.object({
    endpoint: z.string().url("endpoint must be a valid HTTP(s) URL"),
    apiKey: z.string().min(1).optional(),
  }),
  bridgeToken: z.object({
    sourceChain: chainIdEnum,
    targetChain: chainIdEnum,
    tokenAddress: z.string().min(1, "tokenAddress is required"),
    amount: z.string().min(1, "amount is required"),
    recipient: z.string().min(1, "recipient is required"),
    wallet: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.sourceChain === data.targetChain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetChain must differ from sourceChain",
        path: ["targetChain"],
      });
    }
  }),
  routeStatus: z.object({
    sourceChain: chainIdEnum,
    targetChain: chainIdEnum,
  }),
  supportedRoutes: z.object({}).strict(),
  transferStatus: z.object({
    transferId: z.string().min(1, "transferId is required"),
  }),
};
