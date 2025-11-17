import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { DebankSchemas } from "./schemas.js";
import {
  getTokenInfoHandler,
  getUserProtocolListHandler,
  getUserTokenListHandler,
  getUserTotalBalanceHandler,
  setDebankProviderHandler,
} from "./handlers.js";
import { DEBANK_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type DebankSchema = (typeof DebankSchemas)[keyof typeof DebankSchemas];

type DebankToolDefinition<Schema extends DebankSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setDebankProviderHandler>[1],
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

export const debankToolDefinitions: DebankToolDefinition<any>[] = [
  {
    name: "debank_provider_set",
    description: "Configure the DeBank API endpoint and optional API key.",
    schema: DebankSchemas.providerSet,
    execute: setDebankProviderHandler,
    requiredTier: "free",
  },
  {
    name: "debank_user_total_balance",
    description: "Fetch a wallet's total USD value across chains from DeBank.",
    schema: DebankSchemas.userTotalBalance,
    execute: getUserTotalBalanceHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 30_000,
      key: (args) => args.address.toLowerCase(),
    },
  },
  {
    name: "debank_user_tokens",
    description: "Retrieve a detailed token list for a wallet using DeBank.",
    schema: DebankSchemas.userTokenList,
    execute: getUserTokenListHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 30_000,
      key: (args) => args.address.toLowerCase(),
    },
  },
  {
    name: "debank_user_protocols",
    description: "List DeFi protocol exposure for a wallet via DeBank.",
    schema: DebankSchemas.userProtocolList,
    execute: getUserProtocolListHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => args.address.toLowerCase(),
    },
  },
  {
    name: "debank_token_info",
    description: "Fetch token metadata and price statistics from DeBank.",
    schema: DebankSchemas.tokenInfo,
    execute: getTokenInfoHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 300_000,
      key: (args) => `${args.chainId}:${args.tokenAddress.toLowerCase()}`,
    },
  },
];

export const registerDebankModule = (server: FastMCP<ServerSessionMetadata>): void => {
  debankToolDefinitions.forEach((tool) => {
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
            namespace: `${DEBANK_NAMESPACE}:${tool.name}`,
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
