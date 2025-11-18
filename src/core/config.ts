import { z } from "zod";
import type { UsageTier } from "../server/types.js";

export type RemoteServerConfig = {
  id: string;
  label: string;
  toolPrefix: string;
  baseUrl: string;
  authToken?: string;
  headers?: Record<string, string>;
  tags?: string[];
};

const TierSchema = z.enum(["free", "pro", "ultra"]);

const ApiTokenSchema = z.object({
  token: z.string().min(1),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  tier: TierSchema.optional(),
});

type ApiTokenConfig = z.infer<typeof ApiTokenSchema>;

const parseDelimitedToken = (input: string): ApiTokenConfig | null => {
  const segments = input.split(":");
  if (segments.length === 0) {
    return null;
  }

  const [token, userId, organizationId, tier] = segments;
  return {
    token,
    userId: userId || undefined,
    organizationId: organizationId || undefined,
    tier: tier && TierSchema.safeParse(tier).success ? (tier as UsageTier) : undefined,
  };
};

const parseJsonToken = (input: string): ApiTokenConfig | null => {
  try {
    const parsed = JSON.parse(input);
    const result = ApiTokenSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
};

const parseApiTokens = (raw: string | undefined): ApiTokenConfig[] => {
  if (!raw) {
    return [];
  }

  const candidates = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return candidates
    .map((candidate) => parseJsonToken(candidate) ?? parseDelimitedToken(candidate))
    .filter((value): value is ApiTokenConfig => value !== null);
};

const DEFAULT_TIER: UsageTier = "free";

export type AppConfig = {
  defaultTier: UsageTier;
  tokens: ApiTokenConfig[];
  remoteServers: RemoteServerConfig[];
  transport: {
    allowHttp: boolean;
    allowStdio: boolean;
  };
};

const REMOTE_SERVER_DEFINITIONS: Array<{
  id: RemoteServerConfig["id"];
  label: RemoteServerConfig["label"];
  toolPrefix: RemoteServerConfig["toolPrefix"];
  envPrefix: string;
  tags?: RemoteServerConfig["tags"];
}> = [
  {
    id: "alphaArena",
    label: "Alpha Arena",
    toolPrefix: "alpha",
    envPrefix: "ALPHA_ARENA_MCP",
    tags: ["hyperliquid", "perps"],
  },
  {
    id: "dexPools",
    label: "DEX Pools",
    toolPrefix: "dex",
    envPrefix: "DEX_POOLS_MCP",
    tags: ["defi", "geckoterminal"],
  },
  {
    id: "polymarket",
    label: "Polymarket Predictions",
    toolPrefix: "poly",
    envPrefix: "POLYMARKET_PREDICTIONS_MCP",
    tags: ["predictions"],
  },
  {
    id: "hyperliquidInfo",
    label: "Hyperliquid Info",
    toolPrefix: "hyperinfo",
    envPrefix: "HYPERLIQUID_INFO_MCP",
    tags: ["hyperliquid", "analytics"],
  },
  {
    id: "freqtrade",
    label: "Freqtrade",
    toolPrefix: "freq",
    envPrefix: "FREQTRADE_MCP",
    tags: ["tradingbot"],
  },
  {
    id: "hyperliquidWhalealert",
    label: "Hyperliquid Whale Alert",
    toolPrefix: "whale",
    envPrefix: "HYPERLIQUID_WHALEALERT_MCP",
    tags: ["hyperliquid", "alerts"],
  },
  {
    id: "walletInspector",
    label: "Wallet Inspector",
    toolPrefix: "inspector",
    envPrefix: "WALLET_INSPECTOR_MCP",
    tags: ["analytics", "wallet"],
  },
  {
    id: "ethereumValidatorsQueue",
    label: "Ethereum Validators Queue",
    toolPrefix: "validators",
    envPrefix: "ETHEREUM_VALIDATORS_QUEUE_MCP",
    tags: ["ethereum", "validators"],
  },
  {
    id: "findblock",
    label: "FindBlock",
    toolPrefix: "findblock",
    envPrefix: "FINDBLOCK_MCP",
    tags: ["evm", "timestamp"],
  },
  {
    id: "pumpfunWallets",
    label: "Pumpfun Wallets",
    toolPrefix: "pumpfun",
    envPrefix: "PUMPFUN_WALLETS_MCP",
    tags: ["solana", "analytics"],
  },
  {
    id: "honeypotDetector",
    label: "Honeypot Detector",
    toolPrefix: "honeypot",
    envPrefix: "HONEYPOT_DETECTOR_MCP",
    tags: ["security"],
  },
  {
    id: "ensToolkit",
    label: "ENS Toolkit",
    toolPrefix: "ens",
    envPrefix: "ENS_MCP",
    tags: ["ens", "evm"],
  },
  {
    id: "chainlist",
    label: "Chainlist",
    toolPrefix: "chainlist",
    envPrefix: "CHAINLIST_MCP",
    tags: ["chains"],
  },
  {
    id: "rugCheck",
    label: "Rug Check",
    toolPrefix: "rugcheck",
    envPrefix: "RUG_CHECK_MCP",
    tags: ["security", "defi"],
  },
  {
    id: "nftAnalytics",
    label: "NFT Analytics",
    toolPrefix: "nftanalytics",
    envPrefix: "NFT_ANALYTICS_MCP",
    tags: ["nft", "analytics"],
  },
  {
    id: "kukaCryptoProjects",
    label: "Crypto Projects (Kukapay)",
    toolPrefix: "cproj",
    envPrefix: "CRYPTO_PROJECTS_MCP",
    tags: ["defi", "analytics"],
  },
  {
    id: "solanaLaunchpads",
    label: "Solana Launchpads",
    toolPrefix: "launchpads",
    envPrefix: "SOLANA_LAUNCHPADS_MCP",
    tags: ["solana", "launchpad"],
  },
  {
    id: "memecoinRadar",
    label: "Memecoin Radar",
    toolPrefix: "memecoin",
    envPrefix: "MEMECOIN_RADAR_MCP",
    tags: ["memecoin", "analytics"],
  },
  {
    id: "cryptoWhitepapers",
    label: "Crypto Whitepapers",
    toolPrefix: "whitepapers",
    envPrefix: "CRYPTO_WHITEPAPERS_MCP",
    tags: ["documents"],
  },
  {
    id: "deepResearch",
    label: "Deep Research",
    toolPrefix: "deepresearch",
    envPrefix: "DEEP_RESEARCH_MCP",
    tags: ["research", "automation"],
  },
  {
    id: "context7",
    label: "Context7 Memory",
    toolPrefix: "context7",
    envPrefix: "CONTEXT7_MCP",
    tags: ["memory", "context"],
  },
  {
    id: "omnisearch",
    label: "OmniSearch",
    toolPrefix: "omni",
    envPrefix: "OMNISEARCH_MCP",
    tags: ["search", "news"],
  },
  {
    id: "agentCommunication",
    label: "Agent Communication Hub",
    toolPrefix: "agentcomm",
    envPrefix: "AGENT_COMMUNICATION_MCP",
    tags: ["collaboration", "agents"],
  },
  {
    id: "octocode",
    label: "Octocode",
    toolPrefix: "octocode",
    envPrefix: "OCTOCODE_MCP",
    tags: ["automation", "debugging"],
  },
  {
    id: "baseL2",
    label: "Base L2 Toolkit",
    toolPrefix: "base",
    envPrefix: "BASE_MCP",
    tags: ["base", "bridge"],
  },
  {
    id: "okxTrading",
    label: "OKX Trading",
    toolPrefix: "okx",
    envPrefix: "OKX_MCP",
    tags: ["trading", "cex"],
  },
  {
    id: "cryptoOrderbook",
    label: "Crypto Orderbook",
    toolPrefix: "orderbook",
    envPrefix: "CRYPTO_ORDERBOOK_MCP",
    tags: ["marketdata"],
  },
  {
    id: "tokenMinter",
    label: "Token Minter",
    toolPrefix: "tokenminter",
    envPrefix: "TOKEN_MINTER_MCP",
    tags: ["evm", "deploy"],
  },
  {
    id: "worldClock",
    label: "World Clock",
    toolPrefix: "clock",
    envPrefix: "WHATTIMEISIT_MCP",
    tags: ["utility"],
  },
  {
    id: "nearbySearch",
    label: "Nearby Search",
    toolPrefix: "nearby",
    envPrefix: "NEARBY_SEARCH_MCP",
    tags: ["maps", "search"],
  },
];

const parseOptionalJson = (raw: string | undefined): Record<string, string> | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string") {
          acc[key] = value;
        }
        return acc;
      }, {});
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const buildRemoteServers = (): RemoteServerConfig[] => {
  return REMOTE_SERVER_DEFINITIONS.flatMap((definition) => {
    const baseUrl =
      process.env[`${definition.envPrefix}_HTTP_URL`] ??
      process.env[`${definition.envPrefix}_URL`];

    if (!baseUrl) {
      return [];
    }

    const trimmed = baseUrl.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const authToken = process.env[`${definition.envPrefix}_AUTH_TOKEN`]?.trim();
    const headersFromJson = parseOptionalJson(process.env[`${definition.envPrefix}_HEADERS`]);
    const headers: Record<string, string> | undefined = headersFromJson
      ?? (authToken ? { Authorization: `Bearer ${authToken}` } : undefined);

    return [
      {
        id: definition.id,
        label: definition.label,
        toolPrefix: definition.toolPrefix,
        baseUrl: trimmed,
        authToken: authToken || undefined,
        headers,
        tags: definition.tags,
      },
    ];
  });
};

export const loadConfig = (): AppConfig => {
  const defaultTierEnv = process.env.MCP_DEFAULT_TIER ?? DEFAULT_TIER;
  const defaultTier = TierSchema.safeParse(defaultTierEnv).success
    ? (defaultTierEnv as UsageTier)
    : DEFAULT_TIER;

  const tokens = parseApiTokens(process.env.MCP_API_TOKENS);

  const remoteServers = buildRemoteServers();

  const transport = {
    allowHttp: (process.env.MCP_ALLOW_HTTP ?? "true").toLowerCase() !== "false",
    allowStdio: (process.env.MCP_ALLOW_STDIO ?? "true").toLowerCase() !== "false",
  };

  return {
    defaultTier,
    tokens,
    remoteServers,
    transport,
  };
};

export const resolveTokenConfig = (
  config: AppConfig,
  token: string | undefined,
): ApiTokenConfig | null => {
  if (!token) {
    return null;
  }

  return config.tokens.find((candidate) => candidate.token === token) ?? null;
};
