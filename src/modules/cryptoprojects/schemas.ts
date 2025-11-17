import { z } from "zod";

export const CryptoProjectsSchemas = {
  providerSet: z.object({
    endpoint: z.string().url("endpoint must be a valid URL"),
  }),
  protocolDetails: z.object({
    slug: z.string().min(1, "protocol slug is required"),
  }),
  topProtocols: z.object({
    limit: z.number().int().min(1).max(20).optional(),
    chains: z.array(z.string().min(1)).optional(),
    category: z.string().optional(),
  }),
};

