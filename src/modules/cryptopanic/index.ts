import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { CryptoPanicSchemas } from "./schemas.js";
import {
  getLatestNewsHandler,
  setCryptoPanicProviderHandler,
} from "./handlers.js";
import { CRYPTOPANIC_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type CryptoPanicSchema = (typeof CryptoPanicSchemas)[keyof typeof CryptoPanicSchemas];

type CryptoPanicToolDefinition<Schema extends CryptoPanicSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setCryptoPanicProviderHandler>[1],
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

export const cryptoPanicToolDefinitions: CryptoPanicToolDefinition<any>[] = [
  {
    name: "cryptopanic_provider_set",
    description: "Configure the CryptoPanic endpoint and API token.",
    schema: CryptoPanicSchemas.providerSet,
    execute: setCryptoPanicProviderHandler,
    requiredTier: "free",
  },
  {
    name: "cryptopanic_latest_news",
    description: "Fetch the latest CryptoPanic posts with optional filters.",
    schema: CryptoPanicSchemas.latestNews,
    execute: getLatestNewsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 30_000,
      key: (args) => JSON.stringify(args ?? {}),
    },
  },
];

export const registerCryptoPanicModule = (server: FastMCP<ServerSessionMetadata>): void => {
  cryptoPanicToolDefinitions.forEach((tool) => {
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
            namespace: `${CRYPTOPANIC_NAMESPACE}:${tool.name}`,
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
