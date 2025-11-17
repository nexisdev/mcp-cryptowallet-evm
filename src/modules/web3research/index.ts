import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { Web3ResearchSchemas } from "./schemas.js";
import {
  assetDetailsHandler,
  searchAssetsHandler,
  setWeb3ResearchProviderHandler,
  trendingHandler,
} from "./handlers.js";
import { WEB3RESEARCH_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type Web3ResearchSchema = (typeof Web3ResearchSchemas)[keyof typeof Web3ResearchSchemas];

type Web3ResearchToolDefinition<Schema extends Web3ResearchSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setWeb3ResearchProviderHandler>[1],
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

export const web3ResearchToolDefinitions: Web3ResearchToolDefinition<any>[] = [
  {
    name: "web3research_provider_set",
    description: "Configure the CoinGecko API endpoint used for research.",
    schema: Web3ResearchSchemas.providerSet,
    execute: setWeb3ResearchProviderHandler,
    requiredTier: "free",
  },
  {
    name: "web3research_search_assets",
    description: "Search CoinGecko for assets by name or symbol.",
    schema: Web3ResearchSchemas.searchAssets,
    execute: searchAssetsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => args.query.toLowerCase(),
    },
  },
  {
    name: "web3research_asset_details",
    description: "Retrieve detailed market data for a CoinGecko asset.",
    schema: Web3ResearchSchemas.assetDetails,
    execute: assetDetailsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => `${args.id}:${args.currency.toLowerCase()}`,
    },
  },
  {
    name: "web3research_trending",
    description: "List trending assets on CoinGecko.",
    schema: Web3ResearchSchemas.trending,
    execute: trendingHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 120_000,
      key: () => "trending",
    },
  },
];

export const registerWeb3ResearchModule = (server: FastMCP<ServerSessionMetadata>): void => {
  web3ResearchToolDefinitions.forEach((tool) => {
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
            namespace: `${WEB3RESEARCH_NAMESPACE}:${tool.name}`,
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
