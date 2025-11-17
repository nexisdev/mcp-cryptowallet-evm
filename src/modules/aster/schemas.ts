import { z } from "zod";

const symbolSchema = z.string().min(1, "symbol is required");

export const AsterSchemas = {
  kline: z.object({
    symbol: symbolSchema,
    interval: z.string().min(1, "interval is required"),
    startTime: z.number().int().nonnegative().optional(),
    endTime: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(1500).optional(),
  }),
  orderBook: z.object({
    symbol: symbolSchema,
    limit: z.number().int().min(5).max(5000).optional(),
  }),
  recentTrades: z.object({
    symbol: symbolSchema,
    limit: z.number().int().min(1).max(1000).optional(),
  }),
  orderBookTicker: z.object({
    symbol: z.string().min(1).optional(),
  }),
} as const;
