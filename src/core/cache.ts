import { Context } from "fastmcp";
import type { SessionMetadata } from "../server/types.js";
import { ToolResult, ToolMiddleware } from "./middleware.js";

type CacheContext = Context<SessionMetadata>;

type CacheEntry = {
  expiresAt: number;
  value: ToolResult;
};

type CacheKeyFn<TArgs> = (input: {
  name: string;
  args: TArgs;
  context: CacheContext;
}) => string;

interface CacheOptions<TArgs> {
  namespace: string;
  ttlMs: number;
  keyBuilder: CacheKeyFn<TArgs>;
}

const caches = new Map<string, Map<string, CacheEntry>>();

const getCacheBucket = (namespace: string): Map<string, CacheEntry> => {
  const existing = caches.get(namespace);
  if (existing) {
    return existing;
  }
  const bucket = new Map<string, CacheEntry>();
  caches.set(namespace, bucket);
  return bucket;
};

export const createResponseCacheMiddleware = <TArgs>({
  namespace,
  ttlMs,
  keyBuilder,
}: CacheOptions<TArgs>): ToolMiddleware<TArgs> => {
  const bucket = getCacheBucket(namespace);

  return async ({ name, args, context, next }) => {
    const key = keyBuilder({ name, args, context });
    const now = Date.now();
    const cached = bucket.get(key);

    if (cached && cached.expiresAt > now) {
      context.log.debug("[cache] hit", { namespace, key });
      return cached.value;
    }

    const result = await next();
    bucket.set(key, {
      value: result,
      expiresAt: now + ttlMs,
    });
    context.log.debug("[cache] miss", { namespace, key });
    return result;
  };
};

export const __testing = {
  reset: (): void => {
    caches.forEach((bucket) => bucket.clear());
  },
  snapshot: (namespace: string): Map<string, CacheEntry> | undefined => {
    return caches.get(namespace);
  },
};
