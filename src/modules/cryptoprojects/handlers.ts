import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import { CryptoProjectsClient } from "./client.js";
import {
  getCryptoProjectsConfig,
  setCryptoProjectsConfig,
} from "./state.js";
import type { ServerContext } from "../../server/types.js";

type CryptoProjectsContext = ServerContext;

const createClient = (context: CryptoProjectsContext): CryptoProjectsClient => {
  const { endpoint } = getCryptoProjectsConfig(context);
  return new CryptoProjectsClient(endpoint);
};

export const setCryptoProjectsProviderHandler = async (
  params: { endpoint: string },
  context: CryptoProjectsContext,
): Promise<string> => {
  try {
    new URL(params.endpoint);
  } catch {
    throw new UserError("endpoint must be a valid URL");
  }

  setCryptoProjectsConfig(context, { endpoint: params.endpoint });
  return formatKeyValue("Crypto Projects endpoint configured", { endpoint: params.endpoint });
};

export const getProtocolDetailsHandler = async (
  params: { slug: string },
  context: CryptoProjectsContext,
): Promise<string> => {
  const client = createClient(context);
  const protocol = await client.getProtocol(params.slug);

  return formatKeyValue("Protocol overview", {
    name: protocol.name,
    symbol: protocol.symbol ?? "n/a",
    tvl: `$${protocol.tvl.toLocaleString()}`,
    category: protocol.category ?? "n/a",
    chains: protocol.chains.join(", "),
    change1h: `${protocol.change_1h?.toFixed(2) ?? "n/a"}%`,
    change1d: `${protocol.change_1d?.toFixed(2) ?? "n/a"}%`,
    change7d: `${protocol.change_7d?.toFixed(2) ?? "n/a"}%`,
    url: protocol.url ?? "n/a",
    description: protocol.description ? truncate(protocol.description, 280) : "n/a",
  });
};

export const getTopProtocolsHandler = async (
  params: { limit?: number; chains?: string[]; category?: string },
  context: CryptoProjectsContext,
): Promise<string> => {
  const client = createClient(context);
  const limit = params.limit ?? 10;
  const protocols = await client.listProtocols();

  const filtered = protocols
    .filter((protocol) =>
      params.chains?.length
        ? params.chains.some((chain) => protocol.chain.toLowerCase() === chain.toLowerCase())
        : true,
    )
    .filter((protocol) =>
      params.category
        ? protocol.category?.toLowerCase() === params.category.toLowerCase()
        : true,
    )
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit);

  if (!filtered.length) {
    return "No protocols matched the supplied filters.";
  }

  const lines = filtered.map((protocol, index) => {
    return `${index + 1}. ${protocol.name} (${protocol.chain}) – $${protocol.tvl.toLocaleString()} TVL – ${protocol.category}`;
  });

  return ["Top protocols by TVL:", ...lines].join("\n");
};

const truncate = (value: string, length: number): string =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;
