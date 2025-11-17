import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import {
  analyzeLiquidityHandler,
  getAaveProviderInfoHandler,
  getReservesHandler,
  getUserDataHandler,
  getUserHealthHandler,
  listAaveNamespacesHandler,
  setAaveProviderHandler,
} from "./handlers.js";
import { AaveSchemas } from "./schemas.js";
import { AAVE_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type AaveSchema = (typeof AaveSchemas)[keyof typeof AaveSchemas];

type AaveToolDefinition<Schema extends AaveSchema> = {
  name: string;
  description: string;
  schema: Schema;
  annotations?: { readOnlyHint?: boolean };
  requiredTier?: UsageTier;
  featureName?: string;
  cache?: {
    ttlMs: number;
    key: (args: z.infer<Schema>) => string;
  };
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setAaveProviderHandler>[1],
  ) => Promise<string>;
};

const READ_ONLY_HINT = { readOnlyHint: true };

export const aaveToolDefinitions: Array<AaveToolDefinition<any>> = [
  {
    name: "aave_provider_set",
    description:
      "Override the Aave subgraph endpoint, API key, or cache TTL for the current session.",
    schema: AaveSchemas.providerSet,
    execute: setAaveProviderHandler,
    requiredTier: "free",
  },
  {
    name: "aave_provider_info",
    description: "Display the active Aave provider configuration for this session.",
    schema: z.object({}),
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    execute: getAaveProviderInfoHandler,
  },
  {
    name: "aave_reserves_overview",
    description:
      "Summarize the top Aave reserves with liquidity and rate information (cached for 60 seconds).",
    schema: AaveSchemas.reserves,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: () => "reserves_overview",
    },
    execute: getReservesHandler,
  },
  {
    name: "aave_analyze_liquidity",
    description: "Inspect liquidity metrics for a specific Aave reserve symbol.",
    schema: AaveSchemas.analyzeLiquidity,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 30_000,
      key: (args) => args.symbol.toLowerCase(),
    },
    execute: analyzeLiquidityHandler,
  },
  {
    name: "aave_user_positions",
    description: "List collateral and debt balances for an address across Aave markets.",
    schema: AaveSchemas.userData,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 15_000,
      key: (args) => args.userAddress.toLowerCase(),
    },
    execute: getUserDataHandler,
  },
  {
    name: "aave_user_health",
    description:
      "Return health factor and borrow/collateral summary for an address to assess liquidation risk.",
    schema: AaveSchemas.userHealth,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 15_000,
      key: (args) => args.userAddress.toLowerCase(),
    },
    execute: getUserHealthHandler,
  },
  {
    name: "aave_namespace_info",
    description: "Describe how the Aave module stores per-session data.",
    schema: z.object({}),
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    execute: async () => listAaveNamespacesHandler(),
  },
];

export const registerAaveModule = (server: FastMCP<ServerSessionMetadata>): void => {
  aaveToolDefinitions.forEach((tool) => {
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
            namespace: `${AAVE_NAMESPACE}:${tool.name}`,
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
