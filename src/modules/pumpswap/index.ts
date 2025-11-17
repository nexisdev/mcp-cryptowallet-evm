import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { PumpSwapSchemas } from "./schemas.js";
import {
  getPriceHandler,
  getQuoteHandler,
  getTokenInfoHandler,
  setPumpSwapProviderHandler,
} from "./handlers.js";
import { PUMPSWAP_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type PumpSwapSchema = (typeof PumpSwapSchemas)[keyof typeof PumpSwapSchemas];

type PumpSwapToolDefinition<Schema extends PumpSwapSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setPumpSwapProviderHandler>[1],
  ) => Promise<string>;
  annotations?: { readOnlyHint?: boolean };
  requiredTier?: UsageTier;
  featureName?: string;
  cache?: {
    ttlMs: number;
    key: (args: z.infer<Schema>) => string;
  };
};

const READ_ONLY_HINT = { readOnlyHint: true };

export const pumpSwapToolDefinitions: PumpSwapToolDefinition<any>[] = [
  {
    name: "pumpswap_provider_set",
    description: "Configure Jupiter API endpoints and default slippage for PumpSwap tools.",
    schema: PumpSwapSchemas.providerSet,
    execute: setPumpSwapProviderHandler,
    requiredTier: "free",
  },
  {
    name: "pumpswap_price",
    description: "Fetch the latest USD price for a Solana token via Jupiter.",
    schema: PumpSwapSchemas.price,
    execute: getPriceHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 15_000,
      key: (args) => args.mint,
    },
  },
  {
    name: "pumpswap_quote",
    description: "Get a Jupiter swap quote between two Solana tokens.",
    schema: PumpSwapSchemas.quote,
    execute: getQuoteHandler,
    requiredTier: "pro",
    featureName: "Solana swap quoting",
  },
  {
    name: "pumpswap_token_info",
    description: "Retrieve metadata for a Solana token from Jupiter.",
    schema: PumpSwapSchemas.tokenInfo,
    execute: getTokenInfoHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 300_000,
      key: (args) => args.mint,
    },
  },
];

export const registerPumpSwapModule = (server: FastMCP<ServerSessionMetadata>): void => {
  pumpSwapToolDefinitions.forEach((tool) => {
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
            namespace: `${PUMPSWAP_NAMESPACE}:${tool.name}`,
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
        if (typeof result === "string" || typeof result === "undefined") {
          return result;
        }
        if (typeof result === "object" && result !== null && "content" in result) {
          return result as any;
        }
        return String(result);
      },
    });
  });
};
