import { setTimeout as delay } from "node:timers/promises";

type ProbeOptions = {
  baseUrl: string;
  timeoutMs: number;
  hardFailOnDependencyDown: boolean;
  verbose: boolean;
};

type DependencySnapshot = {
  status: "up" | "degraded" | "down";
  latencyMs: number;
  checkedAt: string;
  error?: string;
};

type StatusSnapshot = {
  dependencies: Record<string, DependencySnapshot>;
  service: {
    name: string;
    uptimeSeconds: number;
  };
  tools: {
    queueDepth: number;
    failures: number;
    successes: number;
    totalExecutions: number;
  };
};

const parseArgs = (): ProbeOptions => {
  const baseUrl = process.env.STATUS_SERVER_BASE_URL ?? "http://127.0.0.1:8090";
  let timeoutMs = Number.parseInt(process.env.STATUS_PROBE_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    timeoutMs = 5_000;
  }
  const cliArgs = process.argv.slice(2);
  const strictFlag = cliArgs.includes("--strict");
  const hardFailOnDependencyDown =
    strictFlag || (process.env.STATUS_PROBE_STRICT ?? "").toLowerCase() === "true";
  const verbose = strictFlag || (process.env.STATUS_PROBE_VERBOSE ?? "").toLowerCase() === "true";

  return {
    baseUrl,
    timeoutMs,
    hardFailOnDependencyDown,
    verbose,
  };
};

const fetchWithTimeout = async <T>(url: string, timeoutMs: number): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) ${response.statusText}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

const checkHealth = async (options: ProbeOptions): Promise<void> => {
  const url = `${options.baseUrl}/health`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status}) ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
};

const checkStatus = async (options: ProbeOptions): Promise<StatusSnapshot> => {
  const url = `${options.baseUrl}/status?refresh=1`;
  return fetchWithTimeout<StatusSnapshot>(url, options.timeoutMs);
};

const formatDependencies = (snapshot: StatusSnapshot): string => {
  return Object.entries(snapshot.dependencies)
    .map(([name, details]) => {
      const parts = [
        `${name}: ${details.status}`,
        `latency=${details.latencyMs.toFixed(1)}ms`,
      ];
      if (details.error) {
        parts.push(`error=${details.error}`);
      }
      return parts.join(" ");
    })
    .join("; ");
};

const main = async (): Promise<void> => {
  const options = parseArgs();

  try {
    await checkHealth(options);
    const status = await checkStatus(options);

    if (options.verbose) {
      // eslint-disable-next-line no-console
      console.log(
        `[probe] service=${status.service.name} uptime=${status.service.uptimeSeconds.toFixed(1)}s ` +
          `queueDepth=${status.tools.queueDepth} totals(success=${status.tools.successes},failure=${status.tools.failures})`,
      );
      // eslint-disable-next-line no-console
      console.log(`[probe] dependencies: ${formatDependencies(status)}`);
    }

    if (options.hardFailOnDependencyDown) {
      const downDeps = Object.entries(status.dependencies).filter(
        ([, details]) => details.status === "down",
      );
      if (downDeps.length > 0) {
        throw new Error(
          `Dependencies down: ${downDeps.map(([name]) => name).join(", ")}`,
        );
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[probe] failure",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
    return;
  }

  if (options.verbose) {
    // eslint-disable-next-line no-console
    console.log("[probe] success");
  }
};

const run = async (): Promise<void> => {
  await main();
  // Give stdout a moment to flush in CI/cron contexts
  await delay(25);
};

void run();
