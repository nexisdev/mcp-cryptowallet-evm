import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import { Web3ResearchClient } from "./client.js";
import {
  getWeb3ResearchConfig,
  setWeb3ResearchConfig,
} from "./state.js";
import type { ServerContext } from "../../server/types.js";

type Web3ResearchContext = ServerContext;

const createClient = (context: Web3ResearchContext): Web3ResearchClient => {
  const { endpoint } = getWeb3ResearchConfig(context);
  return new Web3ResearchClient(endpoint);
};

export const setWeb3ResearchProviderHandler = async (
  params: { endpoint: string },
  context: Web3ResearchContext,
): Promise<string> => {
  try {
    new URL(params.endpoint);
  } catch {
    throw new UserError("endpoint must be a valid URL");
  }

  setWeb3ResearchConfig(context, { endpoint: params.endpoint });
  return formatKeyValue("Web3 Research endpoint configured", { endpoint: params.endpoint });
};

export const searchAssetsHandler = async (
  params: { query: string },
  context: Web3ResearchContext,
): Promise<string> => {
  const client = createClient(context);
  const response = await client.searchAssets(params.query);

  if (!response.coins.length) {
    return `No assets found for "${params.query}".`;
  }

  const entries = response.coins.slice(0, 10).map((coin) => {
    return `- ${coin.name} (${coin.symbol.toUpperCase()}) – rank ${coin.market_cap_rank ?? "n/a"} – id: ${coin.id}`;
  });

  return [`Top matches for "${params.query}":`, ...entries].join("\n");
};

export const assetDetailsHandler = async (
  params: { id: string; currency: string },
  context: Web3ResearchContext,
): Promise<string> => {
  const client = createClient(context);
  const details = await client.getAssetDetails(params.id);
  const currency = params.currency.toLowerCase();
  const price = details.market_data.current_price[currency];
  const marketCap = details.market_data.market_cap[currency];
  const priceChange = details.market_data.price_change_percentage_24h ?? 0;

  return formatKeyValue("Asset details", {
    name: details.name,
    symbol: details.symbol.toUpperCase(),
    price: price !== undefined ? `${price} ${currency.toUpperCase()}` : "n/a",
    marketCap: marketCap !== undefined ? `${marketCap.toLocaleString()} ${currency.toUpperCase()}` : "n/a",
    priceChange24h: `${priceChange.toFixed(2)}%`,
    description: truncate(details.description.en ?? "No description provided.", 280),
    homepage: details.links.homepage?.find((url) => url) ?? "n/a",
    image: details.image.large ?? "n/a",
  });
};

export const trendingHandler = async (
  _params: Record<string, never>,
  context: Web3ResearchContext,
): Promise<string> => {
  const client = createClient(context);
  const trending = await client.getTrending();

  if (!trending.coins.length) {
    return "No trending assets reported by CoinGecko.";
  }

  const rows = trending.coins.map((entry) => {
    const item = entry.item;
    return `- ${item.name} (${item.symbol}) – rank ${item.market_cap_rank} – price in BTC: ${item.price_btc}`;
  });

  return ["Trending assets on CoinGecko:", ...rows].join("\n");
};

const truncate = (value: string, length: number): string =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;
