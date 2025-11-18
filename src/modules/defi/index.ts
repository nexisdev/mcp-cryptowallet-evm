import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createResponseCacheMiddleware } from "../../core/cache.js";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
  type ToolMiddleware,
  type ToolResult,
} from "../../core/middleware.js";
import { DefiSchemas } from "./schemas.js";
import {
  convertFormattedToWeiHandler,
  convertWeiToFormattedHandler,
  getDefiProviderHandler,
  getLiquiditySourcesHandler,
  getNetworksHandler,
  getSupportedChainsHandler,
  getSupportedDexesHandler,
  getSwapPriceHandler,
  getSwapQuoteHandler,
  getSwapQuoteStructuredHandler,
  getTokenPriceHandler,
  getTrendingPoolsHandler,
  setDefiProviderHandler,
} from "./handlers.js";
import { DEFI_NAMESPACE } from "./constants.js";
import type {
  SessionMetadata as ServerSessionMetadata,
  ServerContext,
  UsageTier,
} from "../../server/types.js";

const ProviderInfoSchema = z.object({});

type DefiSchema =
  | (typeof DefiSchemas)[keyof typeof DefiSchemas]
  | typeof ProviderInfoSchema;

type DefiToolDefinition<Schema extends z.ZodTypeAny> = {
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
  execute: (args: z.infer<Schema>, context: ServerContext) => Promise<ToolResult>;
};

const READ_ONLY_HINT = { readOnlyHint: true } as const;

const defineDefiTool = <Schema extends DefiSchema>(
  definition: DefiToolDefinition<Schema>,
): DefiToolDefinition<Schema> => definition;

const rawDefiTools = [
  defineDefiTool({
    name: "defi_provider_set",
    description: "Configure aggregator base URL or CoinGecko API key for this session.",
    schema: DefiSchemas.providerSet,
    execute: setDefiProviderHandler,
    requiredTier: "free",
  }),
  defineDefiTool({
    name: "defi_provider_info",
    description: "Show the active DeFi provider configuration.",
    schema: ProviderInfoSchema,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    execute: getDefiProviderHandler,
  }),
  defineDefiTool({
    name: "defi_swap_price",
    description: "Fetch indicative aggregator pricing for a token swap (no signing).",
    schema: DefiSchemas.swapPrice,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 20_000,
      key: (args) =>
        [
          args.chainId,
          args.buyToken.toLowerCase(),
          args.sellToken.toLowerCase(),
          args.sellAmount,
          args.taker?.toLowerCase() ?? "default",
        ].join(":"),
    },
    execute: getSwapPriceHandler,
  }),
  defineDefiTool({
    name: "defi_swap_quote",
    description: "Retrieve an executable aggregator quote with transaction payload.",
    schema: DefiSchemas.swapQuote,
    annotations: READ_ONLY_HINT,
    requiredTier: "pro",
    featureName: "DeFi swap quote generation",
    cache: {
      ttlMs: 20_000,
      key: (args) =>
        [
          args.chainId,
          args.buyToken.toLowerCase(),
          args.sellToken.toLowerCase(),
          args.sellAmount,
          args.slippageBps ?? "default",
          args.taker?.toLowerCase() ?? "default",
        ].join(":"),
    },
    execute: getSwapQuoteHandler,
  }),
  defineDefiTool({
    name: "defi_swap_quote_structured",
    description:
      "Retrieve an executable aggregator quote with structured JSON output for downstream automation.",
    schema: DefiSchemas.swapQuote,
    annotations: READ_ONLY_HINT,
    requiredTier: "pro",
    featureName: "DeFi swap quote structured response",
    cache: {
      ttlMs: 20_000,
      key: (args) =>
        [
          args.chainId,
          args.buyToken.toLowerCase(),
          args.sellToken.toLowerCase(),
          args.sellAmount,
          args.slippageBps ?? "default",
          args.taker?.toLowerCase() ?? "default",
          "structured",
        ].join(":"),
    },
    execute: getSwapQuoteStructuredHandler,
  }),
  defineDefiTool({
    name: "defi_supported_chains",
    description: "List blockchains supported by the configured aggregator instance.",
    schema: DefiSchemas.supportedChains,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 120_000,
      key: () => "chains",
    },
    execute: getSupportedChainsHandler,
  }),
  defineDefiTool({
    name: "defi_liquidity_sources",
    description: "List available liquidity sources for a specific chain.",
    schema: DefiSchemas.liquiditySources,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => String(args.chainId),
    },
    execute: getLiquiditySourcesHandler,
  }),
  defineDefiTool({
    name: "defi_token_price",
    description: "Query CoinGecko onchain token prices for one or more tokens.",
    schema: DefiSchemas.tokenPrice,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) => `${args.network}:${args.addresses.toLowerCase()}`,
    },
    execute: getTokenPriceHandler,
  }),
  defineDefiTool({
    name: "defi_coingecko_networks",
    description: "Page through CoinGecko onchain networks metadata.",
    schema: DefiSchemas.networks,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 300_000,
      key: (args) => `page:${String(args.page ?? 1)}`,
    },
    execute: getNetworksHandler,
  }),
  defineDefiTool({
    name: "defi_supported_dexes",
    description: "List DEXes supported on a CoinGecko onchain network.",
    schema: DefiSchemas.supportedDexes,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 120_000,
      key: (args) => `${args.network}:${String(args.page ?? 1)}`,
    },
    execute: getSupportedDexesHandler,
  }),
  defineDefiTool({
    name: "defi_trending_pools",
    description: "Fetch trending DeFi pools, optionally filtered by network.",
    schema: DefiSchemas.trendingPools,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    cache: {
      ttlMs: 60_000,
      key: (args) =>
        [
          args.network ?? "all",
          args.duration ?? "24h",
          args.page ?? 1,
        ].join(":"),
    },
    execute: getTrendingPoolsHandler,
  }),
  defineDefiTool({
    name: "defi_convert_wei_to_unit",
    description: "Convert a wei-denominated amount into a human readable float.",
    schema: DefiSchemas.weiToUnit,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
    execute: (args, context) =>
      Promise.resolve(convertWeiToFormattedHandler(args, context)),
  }),
  defineDefiTool({
    name: "defi_convert_unit_to_wei",
    description: "Convert a decimal token amount into wei based on decimals.",
    schema: DefiSchemas.unitToWei,
    requiredTier: "free",
    execute: (args, context) =>
      Promise.resolve(convertFormattedToWeiHandler(args, context)),
  }),
] as const;

type StoredDefiToolDefinition = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  annotations?: { readOnlyHint?: boolean };
  requiredTier?: UsageTier;
  featureName?: string;
  cache?: {
    ttlMs: number;
    key: (args: unknown) => string;
  };
  execute: (args: unknown, context: ServerContext) => Promise<ToolResult>;
};

const adaptDefiTool = <Schema extends DefiSchema>(
  tool: DefiToolDefinition<Schema>,
): StoredDefiToolDefinition => {
  const cacheConfig = tool.cache;

  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    annotations: tool.annotations,
    requiredTier: tool.requiredTier,
    featureName: tool.featureName,
    cache: cacheConfig
      ? {
          ttlMs: cacheConfig.ttlMs,
          key: (args: unknown) => cacheConfig.key(args as z.infer<Schema>),
        }
      : undefined,
    execute: (args: unknown, context: ServerContext) =>
      tool.execute(args as z.infer<Schema>, context),
  };
};

export const defiToolDefinitions: ReadonlyArray<StoredDefiToolDefinition> =
  rawDefiTools.map((tool) => adaptDefiTool(tool as DefiToolDefinition<DefiSchema>)) as ReadonlyArray<
    StoredDefiToolDefinition
  >;

const createMiddlewares = <TArgs, TContext extends ServerContext>(
  baseMiddlewares: ToolMiddleware<TArgs, TContext>[],
  cacheMiddleware: ToolMiddleware<TArgs, TContext> | undefined,
): ToolMiddleware<TArgs, TContext>[] => {
  return cacheMiddleware ? [cacheMiddleware, ...baseMiddlewares] : baseMiddlewares;
};

export const registerDefiModule = (server: FastMCP<ServerSessionMetadata>): void => {
  defiToolDefinitions.forEach((tool) => {
    type ToolArgs = Parameters<typeof tool.execute>[0];
    type ToolContext = ServerContext;

    const baseMiddlewares: ToolMiddleware<ToolArgs, ToolContext>[] = [
      tierGuardMiddleware<ToolArgs, ToolContext>({
        requiredTier: tool.requiredTier,
        featureName: tool.featureName,
      }),
      ...defaultToolMiddlewares<ToolArgs, ToolContext>(),
    ];

    const cache = tool.cache;
    const cacheMiddleware: ToolMiddleware<ToolArgs, ToolContext> | undefined = cache
      ? (createResponseCacheMiddleware<ToolArgs>({
          namespace: `${DEFI_NAMESPACE}:${tool.name}`,
          ttlMs: cache.ttlMs,
          keyBuilder: ({ args }) => cache.key(args),
        }) as ToolMiddleware<ToolArgs, ToolContext>)
      : undefined;

    const middlewares: ToolMiddleware<ToolArgs, ToolContext>[] = createMiddlewares<ToolArgs, ToolContext>(
      baseMiddlewares,
      cacheMiddleware,
    );

    // TypeScript incorrectly infers middlewares as any[] when ToolArgs is unknown.
    // This is safe because createMiddlewares preserves the ToolMiddleware type structure.
    const executeWithMiddleware = applyToolMiddleware<ToolArgs, ToolContext>(
      tool.name,
      (args, context) => tool.execute(args, context),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
          return result;
        }
        return String(result);
      },
    });
  });
};
