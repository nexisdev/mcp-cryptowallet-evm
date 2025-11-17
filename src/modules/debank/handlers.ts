import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import { DebankClient } from "./client.js";
import { getDebankConfig, setDebankConfig } from "./state.js";
import { DEBANK_NAMESPACE } from "./constants.js";
import type { ServerContext } from "../../server/types.js";

type DebankContext = ServerContext;

const createClient = (context: DebankContext): DebankClient => {
  const { endpoint, apiKey } = getDebankConfig(context);
  return new DebankClient(endpoint, apiKey);
};

export const setDebankProviderHandler = async (
  params: { endpoint: string; apiKey?: string },
  context: DebankContext,
): Promise<string> => {
  try {
    new URL(params.endpoint);
  } catch {
    throw new UserError("endpoint must be a valid URL");
  }

  setDebankConfig(context, {
    endpoint: params.endpoint,
    apiKey: params.apiKey ?? process.env.DEBANK_API_KEY,
  });

  return formatKeyValue("DeBank endpoint configured", {
    endpoint: params.endpoint,
    apiKey: params.apiKey ? "provided" : "inherited",
  });
};

export const getUserTotalBalanceHandler = async (
  params: { address: string },
  context: DebankContext,
): Promise<string> => {
  const client = createClient(context);
  const response = await client.getTotalBalance(params.address);
  const lines = response.chain_list
    .map((chain) => `  • ${chain.id}: $${chain.usd_value.toFixed(2)}`)
    .join("\n");
  return [
    `Total USD Value: $${response.total_usd_value.toFixed(2)}`,
    "Per-chain breakdown:",
    lines,
  ].join("\n");
};

export const getUserTokenListHandler = async (
  params: { address: string },
  context: DebankContext,
): Promise<string> => {
  const client = createClient(context);
  const tokens = await client.getTokenList(params.address);

  if (!tokens.length) {
    return "No tokens found for this address.";
  }

  const rows = tokens
    .slice(0, 25)
    .map((token) => {
      const value = token.usd_value ?? token.amount * token.price;
      return `- ${token.symbol} (${token.chain}): ${token.amount} (~$${value.toFixed(2)})`;
    });

  if (tokens.length > 25) {
    rows.push(`… ${tokens.length - 25} additional tokens not shown`);
  }

  return ["Token holdings:", ...rows].join("\n");
};

export const getUserProtocolListHandler = async (
  params: { address: string },
  context: DebankContext,
): Promise<string> => {
  const client = createClient(context);
  const protocols = await client.getProtocolList(params.address);

  if (!protocols.length) {
    return "No protocol portfolios found for this address.";
  }

  const rows = protocols.map((protocol) => {
    const total = protocol.portfolio_item_list.reduce((sum, item) => {
      const stats = item.stats ?? {};
      return sum + (stats.net_usd_value ?? stats.asset_usd_value ?? 0);
    }, 0);
    return `- ${protocol.name}: ~$${total.toFixed(2)}`;
  });

  return ["Protocol exposure:", ...rows].join("\n");
};

export const getTokenInfoHandler = async (
  params: { chainId: string; tokenAddress: string },
  context: DebankContext,
): Promise<string> => {
  const client = createClient(context);
  const token = await client.getTokenInfo(params.chainId, params.tokenAddress);

  return formatKeyValue("Token overview", {
    name: token.name,
    symbol: token.symbol,
    price: `$${token.price.toFixed(4)}`,
    priceChange24h: `${token.price_24h_change.toFixed(2)}%`,
    marketCap: token.market_cap ? `$${token.market_cap.toLocaleString()}` : "n/a",
    volume24h: token.volume_24h ? `$${token.volume_24h.toLocaleString()}` : "n/a",
    logo: token.logo_url ?? "n/a",
  });
};
