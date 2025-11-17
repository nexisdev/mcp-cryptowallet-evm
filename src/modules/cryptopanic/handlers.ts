import { UserError } from "fastmcp";
import { formatKeyValue } from "../wallet/utils.js";
import { CryptoPanicClient, CryptoPanicQuery } from "./client.js";
import {
  getCryptoPanicConfig,
  setCryptoPanicConfig,
} from "./state.js";
import type { ServerContext } from "../../server/types.js";

type CryptoPanicContext = ServerContext;

const createClient = (context: CryptoPanicContext): CryptoPanicClient => {
  const { endpoint, apiKey } = getCryptoPanicConfig(context);
  return new CryptoPanicClient(endpoint, apiKey);
};

export const setCryptoPanicProviderHandler = async (
  params: { endpoint: string; apiKey?: string },
  context: CryptoPanicContext,
): Promise<string> => {
  try {
    new URL(params.endpoint);
  } catch {
    throw new UserError("endpoint must be a valid URL");
  }

  setCryptoPanicConfig(context, {
    endpoint: params.endpoint,
    apiKey: params.apiKey ?? process.env.CRYPTOPANIC_API_KEY,
  });

  return formatKeyValue("CryptoPanic endpoint configured", {
    endpoint: params.endpoint,
    apiKey: params.apiKey ? "provided" : "inherited",
  });
};

export const getLatestNewsHandler = async (
  params: {
    kind?: "news" | "media";
    currencies?: string[];
    publicOnly?: boolean;
    limit?: number;
  },
  context: CryptoPanicContext,
): Promise<string> => {
  const client = createClient(context);

  const query: CryptoPanicQuery = {
    kind: params.kind,
    currencies: params.currencies,
    publicOnly: params.publicOnly ?? true,
  };

  const response = await client.fetchPosts(query);
  const posts = response.results.slice(0, params.limit ?? 10);

  if (!posts.length) {
    return "No CryptoPanic posts found for the specified filters.";
  }

  const formatted = posts.map((post) => {
    const published = new Date(post.published_at).toISOString();
    const symbols = post.currencies?.map((item) => item.code).join(", ");
    return [
      `• ${post.title}`,
      `  Source: ${post.source.title} (${post.source.domain})`,
      `  Published: ${published}`,
      symbols ? `  Symbols: ${symbols}` : undefined,
      `  URL: ${post.url}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const summary = [
    `CryptoPanic results (showing ${formatted.length} of ${response.count}):`,
    ...formatted,
  ];

  return summary.join("\n");
};
