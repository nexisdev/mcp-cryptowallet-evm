import { z } from "zod";

export const Web3ResearchSchemas = {
  providerSet: z.object({
    endpoint: z.string().url("endpoint must be a valid URL"),
  }),
  searchAssets: z.object({
    query: z.string().min(2, "query must be at least 2 characters"),
  }),
  assetDetails: z.object({
    id: z.string().min(1, "asset id is required"),
    currency: z.string().default("usd"),
  }),
  trending: z.object({}).strict(),
};

