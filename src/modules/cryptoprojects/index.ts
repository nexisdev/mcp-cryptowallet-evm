import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { CryptoProjectsSchemas } from "./schemas.js";
import {
  getProtocolDetailsHandler,
  getTopProtocolsHandler,
  setCryptoProjectsProviderHandler,
} from "./handlers.js";
import { CRYPTOPROJECTS_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type CryptoProjectsSchema = (typeof CryptoProjectsSchemas)[keyof typeof CryptoProjectsSchemas];

type CryptoProjectsToolDefinition<Schema extends CryptoProjectsSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setCryptoProjectsProviderHandler>[1],
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

export const cryptoProjectsToolDefinitions: CryptoProjectsToolDefinition<any>[] = [
  {
    name: "cryptoprojects_provider_set",
    description: "Configure the DefiLlama API endpoint for project analytics.",
    schema: CryptoProjectsSchemas.providerSet,
    execute: setCryptoProjectsProviderHandler,
    requiredTier: "free",
  },
  {
    name: "cryptoprojects_protocol_details",
    description: "Retrieve a detailed summary for a protocol via DefiLlama.",
    schema: CryptoProjectsSchemas.protocolDetails,
    execute: getProtocolDetailsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => args.slug.toLowerCase(),
    },
  },
  {
    name: "cryptoprojects_top_protocols",
    description: "List top TVL protocols using DefiLlama data.",
    schema: CryptoProjectsSchemas.topProtocols,
    execute: getTopProtocolsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => JSON.stringify(args ?? {}),
    },
  },
];

export const registerCryptoProjectsModule = (server: FastMCP<ServerSessionMetadata>): void => {
  cryptoProjectsToolDefinitions.forEach((tool) => {
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
            namespace: `${CRYPTOPROJECTS_NAMESPACE}:${tool.name}`,
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
