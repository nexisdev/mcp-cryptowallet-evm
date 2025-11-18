import { createResponseCacheMiddleware, __testing } from "../../src/core/cache.js";
import type { SessionMetadata } from "../../src/server/types.js";
import type { Context } from "fastmcp";

describe("createResponseCacheMiddleware", () => {
  const originalEnv = {
    freeMultiplier: process.env.CACHE_TTL_MULTIPLIER_FREE,
    proMultiplier: process.env.CACHE_TTL_MULTIPLIER_PRO,
    ultraMultiplier: process.env.CACHE_TTL_MULTIPLIER_ULTRA,
    freeOverride: process.env.CACHE_TTL_FREE_MS,
    proOverride: process.env.CACHE_TTL_PRO_MS,
    ultraOverride: process.env.CACHE_TTL_ULTRA_MS,
  };

  const restoreEnv = () => {
    process.env.CACHE_TTL_MULTIPLIER_FREE = originalEnv.freeMultiplier;
    process.env.CACHE_TTL_MULTIPLIER_PRO = originalEnv.proMultiplier;
    process.env.CACHE_TTL_MULTIPLIER_ULTRA = originalEnv.ultraMultiplier;
    process.env.CACHE_TTL_FREE_MS = originalEnv.freeOverride;
    process.env.CACHE_TTL_PRO_MS = originalEnv.proOverride;
    process.env.CACHE_TTL_ULTRA_MS = originalEnv.ultraOverride;
  };

  const createContext = (tier: SessionMetadata["tier"]): Context<SessionMetadata> => {
    return {
      session: {
        tier,
      } as SessionMetadata,
      log: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    } as unknown as Context<SessionMetadata>;
  };

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    __testing.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnv();
  });

  test("applies multiplier for tier when override is not provided", async () => {
    process.env.CACHE_TTL_MULTIPLIER_FREE = "2";

    const middleware = createResponseCacheMiddleware<unknown>({
      namespace: "test:multiplier",
      ttlMs: 1_000,
      keyBuilder: () => "cache-key",
    });

    await middleware({
      name: "sample",
      args: {},
      context: createContext("free"),
      next: async () => "value",
    });

    const snapshot = __testing.snapshot("test:multiplier");
    expect(snapshot).toBeDefined();
    const entry = snapshot?.get("cache-key");
    expect(entry).toBeDefined();
    expect(entry?.expiresAt).toBe(1_000_000 + 2_000);
  });

  test("uses explicit override when configured for tier", async () => {
    process.env.CACHE_TTL_PRO_MS = "5000";
    process.env.CACHE_TTL_MULTIPLIER_PRO = "3"; // should be ignored when override present

    const middleware = createResponseCacheMiddleware<unknown>({
      namespace: "test:override",
      ttlMs: 1_000,
      keyBuilder: () => "cache-key",
    });

    await middleware({
      name: "sample",
      args: {},
      context: createContext("pro"),
      next: async () => "value",
    });

    const snapshot = __testing.snapshot("test:override");
    expect(snapshot).toBeDefined();
    const entry = snapshot?.get("cache-key");
    expect(entry).toBeDefined();
    expect(entry?.expiresAt).toBe(1_000_000 + 5_000);
  });
});
