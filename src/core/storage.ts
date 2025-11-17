import Redis from "ioredis";
import type { AppLogger } from "./logging.js";

type StorageDriver = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  disconnect(): Promise<void>;
};

const NAMESPACE_SEPARATOR = ":";

const serialize = (value: unknown): string => {
  return JSON.stringify(value);
};

const deserialize = <T>(value: string | null): T | null => {
  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

class MemoryDriver implements StorageDriver {
  #store = new Map<string, { value: string; expiresAt?: number }>();

  get(key: string): Promise<string | null> {
    const entry = this.#store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
      this.#store.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  set(key: string, value: string, ttlMs?: number): Promise<void> {
    const expiresAt = typeof ttlMs === "number" ? Date.now() + ttlMs : undefined;
    this.#store.set(key, { value, expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#store.delete(key);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.#store.clear();
    return Promise.resolve();
  }
}

class RedisDriver implements StorageDriver {
  #client: any;
  #logger: AppLogger;

  constructor(url: string, logger: AppLogger) {
    this.#logger = logger;
    const RedisCtor: any = Redis as unknown as { new (url: string, options: unknown): any };
    this.#client = new RedisCtor(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async #ensureConnected(): Promise<void> {
    if (this.#client.status === "ready" || this.#client.status === "connecting") {
      return;
    }

    try {
      await this.#client.connect();
    } catch (error) {
      this.#logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "[storage] redis connect failed",
      );
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    await this.#ensureConnected();
    return this.#client.get(key);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    await this.#ensureConnected();
    if (typeof ttlMs === "number") {
      await this.#client.set(key, value, "PX", ttlMs);
      return;
    }
    await this.#client.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.#ensureConnected();
    await this.#client.del(key);
  }

  async disconnect(): Promise<void> {
    if (this.#client.status === "end" || this.#client.status === "close") {
      return;
    }

    try {
      await this.#client.quit();
    } catch (error) {
      this.#logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "[storage] redis quit failed",
      );
      await this.#client.disconnect();
    }
  }
}

export type StorageOptions = {
  namespace: string;
  logger: AppLogger;
  redisUrl?: string;
};

export class StorageProvider {
  #namespace: string;
  #driver: StorageDriver;
  #logger: AppLogger;

  constructor(options: StorageOptions) {
    const { namespace, redisUrl, logger } = options;
    this.#namespace = namespace;
    this.#logger = logger;
    this.#driver = redisUrl
      ? new RedisDriver(redisUrl, logger)
      : new MemoryDriver();
  }

  #key(key: string): string {
    return `${this.#namespace}${NAMESPACE_SEPARATOR}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.#driver.get(this.#key(key));
    return deserialize<T>(raw);
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const payload = serialize(value);
    await this.#driver.set(this.#key(key), payload, ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.#driver.delete(this.#key(key));
  }

  async shutdown(): Promise<void> {
    await this.#driver.disconnect();
  }

  describe(): { driver: "redis" | "memory"; namespace: string } {
    return {
      driver: this.#driver instanceof RedisDriver ? "redis" : "memory",
      namespace: this.#namespace,
    };
  }
}

export const createStorageProvider = (options: StorageOptions): StorageProvider => {
  return new StorageProvider(options);
};
