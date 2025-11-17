import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import { WormholeSchemas } from "./schemas.js";
import {
  bridgeTokenHandler,
  routeStatusHandler,
  setWormholeEndpointHandler,
  supportedRoutesHandler,
  transferStatusHandler,
  listSupportedChainsHandler,
} from "./handlers.js";
import { WORMHOLE_NAMESPACE } from "./constants.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type WormholeSchema = (typeof WormholeSchemas)[keyof typeof WormholeSchemas];

type WormholeToolDefinition<Schema extends WormholeSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setWormholeEndpointHandler>[1],
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

export const wormholeToolDefinitions: WormholeToolDefinition<any>[] = [
  {
    name: "wormhole_provider_set",
    description: "Configure the Wormhole API endpoint and credentials.",
    schema: WormholeSchemas.providerSet,
    execute: setWormholeEndpointHandler,
    requiredTier: "free",
  },
  {
    name: "wormhole_bridge_token",
    description: "Initiate a Wormhole bridge transfer between supported chains.",
    schema: WormholeSchemas.bridgeToken,
    execute: bridgeTokenHandler,
    requiredTier: "pro",
    featureName: "Wormhole bridge execution",
  },
  {
    name: "wormhole_route_status",
    description: "Retrieve Wormhole route health and estimated settlement time.",
    schema: WormholeSchemas.routeStatus,
    execute: routeStatusHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => `${args.sourceChain}:${args.targetChain}`,
    },
  },
  {
    name: "wormhole_supported_routes",
    description: "List available Wormhole bridging routes using the configured endpoint.",
    schema: WormholeSchemas.supportedRoutes,
    execute: supportedRoutesHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 5 * 60_000,
      key: () => "supported_routes",
    },
  },
  {
    name: "wormhole_transfer_status",
    description: "Check the status of a previously initiated Wormhole transfer.",
    schema: WormholeSchemas.transferStatus,
    execute: transferStatusHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
];

export const registerWormholeModule = (server: FastMCP<ServerSessionMetadata>): void => {
  wormholeToolDefinitions.forEach((tool) => {
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
            namespace: `${WORMHOLE_NAMESPACE}:${tool.name}`,
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

  server.addTool({
    name: "wormhole_supported_chains",
    description: "List the supported Wormhole chains available in this server.",
    parameters: z.object({}),
    annotations: READ_ONLY_HINT,
    execute: async () => listSupportedChainsHandler(),
  });
};
