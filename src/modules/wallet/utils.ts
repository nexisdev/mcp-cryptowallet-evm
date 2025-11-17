import { UserError } from "fastmcp";
import { ethers } from "ethers";
import type { ServerContext } from "../../server/types.js";

const DEFAULT_PROVIDER_URL =
  process.env.PROVIDER_URL ?? "https://eth.llamarpc.com";
const DEFAULT_SESSION_KEY = "global";
const DEFAULT_NAMESPACE = "evm";

type ProviderState = {
  provider: ethers.providers.Provider;
  url: string;
};

const providerRegistry = new Map<string, ProviderState>();

type WalletContext = ServerContext;

const resolveSessionKey = (
  context: WalletContext,
  namespace: string,
): string => `${namespace}:${context.sessionId ?? DEFAULT_SESSION_KEY}`;

const createProvider = (url: string): ProviderState => {
  try {
    const provider =
      url.startsWith("http") || url.startsWith("ws")
        ? new ethers.providers.JsonRpcProvider(url)
        : ethers.getDefaultProvider(url);

    return { provider, url };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown provider error";
    throw new UserError(`Invalid provider URL: ${url}`, {
      reason: message,
    });
  }
};

const ensureProviderState = (
  context: WalletContext,
  url: string,
  namespace: string,
): ProviderState => {
  const key = resolveSessionKey(context, namespace);
  const existing = providerRegistry.get(key);

  if (existing && existing.url === url) {
    return existing;
  }

  const state = createProvider(url);
  providerRegistry.set(key, state);
  return state;
};

export const getProvider = (
  context: WalletContext,
  fallbackUrl: string = DEFAULT_PROVIDER_URL,
  namespace: string = DEFAULT_NAMESPACE,
): ethers.providers.Provider => {
  const key = resolveSessionKey(context, namespace);
  let state = providerRegistry.get(key);

  if (!state) {
    state = ensureProviderState(context, fallbackUrl, namespace);
    context.log.info("[wallet] Initialized provider", { url: state.url, namespace });
  }

  return state.provider;
};

export const setProvider = async (
  context: WalletContext,
  providerURL: string,
  namespace: string = DEFAULT_NAMESPACE,
): Promise<{ url: string }> => {
  const state = ensureProviderState(context, providerURL, namespace);
  context.log.info("[wallet] Provider set", { url: state.url, namespace });
  return { url: state.url };
};

export const getWallet = async (
  context: WalletContext,
  walletData?: string,
  password?: string,
  namespace: string = DEFAULT_NAMESPACE,
): Promise<ethers.Wallet> => {
  const provider = getProvider(context, DEFAULT_PROVIDER_URL, namespace);

  const resolveWalletFromEnv = () => {
    const secret = process.env.PRIVATE_KEY;
    if (!secret) {
      throw new UserError(
        "Wallet data is required. Provide a wallet argument or set PRIVATE_KEY.",
      );
    }
    const wallet = new ethers.Wallet(secret);
    return provider ? wallet.connect(provider) : wallet;
  };

  if (!walletData) {
    return resolveWalletFromEnv();
  }

  try {
    if (walletData.trim().startsWith("{")) {
      if (!password) {
        throw new UserError(
          "Password is required to decrypt encrypted JSON wallet.",
        );
      }
      const wallet = await ethers.Wallet.fromEncryptedJson(
        walletData,
        password,
      );
      return provider ? wallet.connect(provider) : wallet;
    }

    const words = walletData.trim().split(/\s+/);
    if ([12, 15, 18, 21, 24].includes(words.length)) {
      const wallet = ethers.Wallet.fromMnemonic(walletData);
      return provider ? wallet.connect(provider) : wallet;
    }

    const wallet = new ethers.Wallet(walletData);
    return provider ? wallet.connect(provider) : wallet;
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Invalid wallet details";
    throw new UserError(`Failed to load wallet: ${message}`);
  }
};

export const formatKeyValue = (
  title: string,
  data: Record<string, unknown>,
): string => {
  const lines = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}: ${String(value)}`);

  return [title, ...lines].join("\n");
};

export const __testing = {
  resetProviders: (): void => {
    providerRegistry.clear();
  },
};
