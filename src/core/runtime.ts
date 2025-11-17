import { createLogger } from "./logging.js";
import { createStorageProvider, StorageProvider } from "./storage.js";

export type RuntimeDependencies = {
  logger: ReturnType<typeof createLogger>;
  storage: StorageProvider;
};

const DEFAULT_STORAGE_NAMESPACE = "mcp-cryptowallet";

let cachedRuntime: RuntimeDependencies | null = null;

const buildRuntime = (): RuntimeDependencies => {
  const logger = createLogger();

  const storageNamespace =
    process.env.FASTMCP_STORAGE_NAMESPACE ?? DEFAULT_STORAGE_NAMESPACE;

  const storage = createStorageProvider({
    namespace: storageNamespace,
    redisUrl: process.env.REDIS_URL,
    logger,
  });

  const description = storage.describe();
  logger.info(
    {
      driver: description.driver,
      namespace: description.namespace,
    },
    "[runtime] storage driver ready",
  );

  return {
    logger,
    storage,
  };
};

export const initializeRuntime = (): RuntimeDependencies => {
  if (cachedRuntime) {
    return cachedRuntime;
  }

  cachedRuntime = buildRuntime();
  return cachedRuntime;
};

export const getRuntime = (): RuntimeDependencies => {
  if (!cachedRuntime) {
    cachedRuntime = buildRuntime();
  }

  return cachedRuntime;
};
