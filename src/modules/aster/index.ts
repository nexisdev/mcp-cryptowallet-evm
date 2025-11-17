import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import type { SessionMetadata, UsageTier } from "../../server/types.js";
import { AsterSchemas } from "./schemas.js";
import {
  getKlineHandler,
  getOrderBookHandler,
  getOrderBookTickerHandler,
  getRecentTradesHandler,
} from "./handlers.js";
import { ASTER_NAMESPACE } from "./constants.js";

type AsterSchema = (typeof AsterSchemas)[keyof typeof AsterSchemas];

type AsterToolDefinition<Schema extends AsterSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof getKlineHandler>[1],
  ) => Promise<string>;
  cache?: {
    ttlMs: number;
    key: (args: z.infer<Schema>) => string;
  };
  annotations?: { readOnlyHint?: boolean };
  requiredTier?: UsageTier;
  featureName?: string;
};

const READ_ONLY_HINT = { readOnlyHint: true };

export const asterToolDefinitions: Array<AsterToolDefinition<any>> = [
  {
    name: "aster_kline",
    description: "Fetch candlestick data for a symbol and interval.",
    schema: AsterSchemas.kline,
    execute: getKlineHandler,
    cache: {
      ttlMs: 30_000,
      key: (args) =>
        [
          args.symbol.toUpperCase(),
          args.interval,
          args.startTime ?? "start",
          args.endTime ?? "end",
          args.limit ?? "default",
        ].join(":"),
    },
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "aster_order_book_ticker",
    description: "Fetch best bid/ask for a symbol (or all symbols) from Aster.",
    schema: AsterSchemas.orderBookTicker,
    execute: getOrderBookTickerHandler,
    cache: {
      ttlMs: 15_000,
      key: (args) => (args.symbol ? args.symbol.toUpperCase() : "all"),
    },
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "aster_order_book",
    description: "Retrieve order book bids and asks for a symbol.",
    schema: AsterSchemas.orderBook,
    execute: getOrderBookHandler,
    cache: {
      ttlMs: 10_000,
      key: (args) => `${args.symbol.toUpperCase()}:${args.limit ?? "default"}`,
    },
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "aster_recent_trades",
    description: "List recent trades for a symbol.",
    schema: AsterSchemas.recentTrades,
    execute: getRecentTradesHandler,
    cache: {
      ttlMs: 5_000,
      key: (args) => `${args.symbol.toUpperCase()}:${args.limit ?? "default"}`,
    },
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
];

export const registerAsterModule = (server: FastMCP<SessionMetadata>): void => {
  asterToolDefinitions.forEach((tool) => {
    type ToolArgs = z.infer<typeof tool.schema>;
    type ToolContext = Parameters<typeof tool.execute>[1];

    const baseMiddlewares = [
      tierGuardMiddleware<ToolArgs, ToolContext>({
        requiredTier: tool.requiredTier,
        featureName: tool.featureName,
      }),
      ...defaultToolMiddlewares<ToolArgs, ToolContext>(),
    ];

    const middlewares = tool.cache
      ? [
          createResponseCacheMiddleware<ToolArgs>({
            namespace: `${ASTER_NAMESPACE}:${tool.name}`,
            ttlMs: tool.cache.ttlMs,
            keyBuilder: ({ args }) => tool.cache!.key(args),
          }),
          ...baseMiddlewares,
        ]
      : baseMiddlewares;

    const executeWithMiddleware = applyToolMiddleware<ToolArgs, ToolContext>(
      tool.name,
      tool.execute,
      middlewares,
    );

    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
      annotations: tool.annotations,
      execute: async (args: ToolArgs, context: ToolContext) => {
        const result = await executeWithMiddleware(args, context);
        if (typeof result === "string") {
          return {
            content: [
              {
                type: "text" as const,
                text: result,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      },
    });
  });
};
