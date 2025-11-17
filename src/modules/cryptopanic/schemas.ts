import { z } from "zod";

const currencyCode = z
  .string()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,10}$/, "currency code must be alphanumeric");

export const CryptoPanicSchemas = {
  providerSet: z.object({
    endpoint: z.string().url("endpoint must be a valid URL"),
    apiKey: z.string().min(1).optional(),
  }),
  latestNews: z.object({
    kind: z.enum(["news", "media"]).optional(),
    currencies: z.array(currencyCode).min(1).max(5).optional(),
    publicOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
};

