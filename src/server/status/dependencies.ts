import { performance } from "node:perf_hooks";

import type { StorageProvider } from "../../core/storage.js";
import type { StatusMonitor } from "./statusMonitor.js";

const STATUS_PROBE_KEY = "status_probe:ping";

export const registerDefaultDependencies = (
  monitor: StatusMonitor,
  storage: StorageProvider,
): void => {
  monitor.registerDependency("storage", async () => {
    const started = performance.now();
    try {
      const payload = { ok: true, ts: Date.now() };
      await storage.set(STATUS_PROBE_KEY, payload, 1_000);
      const fetched = await storage.get<typeof payload>(STATUS_PROBE_KEY);

      const latencyMs = performance.now() - started;
      return {
        status: fetched?.ok ? "up" as const : "degraded" as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
        details: storage.describe(),
      };
    } catch (error) {
      const latencyMs = performance.now() - started;
      return {
        status: "down" as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        details: storage.describe(),
      };
    }
  });
};

