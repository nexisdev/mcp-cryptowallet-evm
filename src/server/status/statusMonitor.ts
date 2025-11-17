import os from "node:os";

import type { ServerContext } from "../types.js";

type DependencyStatus = "up" | "degraded" | "down";

export type DependencyCheckResult = {
  status: DependencyStatus;
  latencyMs: number;
  checkedAt: string;
  error?: string;
  details?: Record<string, unknown>;
};

export type DependencyCheck = () => Promise<DependencyCheckResult>;

export type ToolExecutionRecord = {
  totalInvocations: number;
  successes: number;
  failures: number;
  totalDurationMs: number;
  averageDurationMs: number;
  lastInvocationAt?: string;
  lastError?: {
    message: string;
    occurredAt: string;
  };
};

export type StatusSnapshot = {
  service: {
    name: string;
    version?: string;
    startTime: string;
    uptimeSeconds: number;
    pid: number;
  };
  system: {
    loadAverages: [number, number, number];
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
    };
  };
  sessions: {
    active: number;
    totalSinceStartup: number;
    lastActivityAt?: string;
    details: Array<{
      sessionId: string;
      tier?: string;
      userId?: string;
      organizationId?: string;
      connectedAt: string;
      lastSeenAt?: string;
      totalExecutions: number;
    }>;
  };
  tools: {
    queueDepth: number;
    totalExecutions: number;
    successes: number;
    failures: number;
    averageDurationMs: number;
    lastError?: {
      toolName: string;
      message: string;
      occurredAt: string;
    };
    perTool: Record<string, ToolExecutionRecord>;
  };
  dependencies: Record<string, DependencyCheckResult>;
  generatedAt: string;
};

type SessionRecord = {
  sessionId: string;
  connectedAt: string;
  lastSeenAt?: string;
  tier?: string;
  userId?: string;
  organizationId?: string;
  totalExecutions: number;
};

type StatusMonitorOptions = {
  serviceName: string;
  serviceVersion?: string;
  dependencyCacheTtlMs?: number;
};

// Singleton instance
let instance: StatusMonitor | null = null;

const DEFAULT_DEPENDENCY_CACHE_TTL_MS = 15_000;

export class StatusMonitor {
  static initialize(options: StatusMonitorOptions): StatusMonitor {
    if (!instance) {
      instance = new StatusMonitor(options);
    }
    return instance;
  }

  static get(): StatusMonitor {
    if (!instance) {
      throw new Error("StatusMonitor has not been initialized");
    }
    return instance;
  }

  readonly #serviceName: string;
  readonly #serviceVersion?: string;
  readonly #startedAt = Date.now();
  #lastActivityAt?: number;

  #activeSessions = new Map<string, SessionRecord>();
  #anonymousSessionCounter = 0;
  #totalSessions = 0;

  #activeExecutions = 0;
  #totalExecutions = 0;
  #totalDurationMs = 0;
  #successes = 0;
  #failures = 0;

  #toolStats = new Map<string, ToolExecutionRecord>();
  #lastToolError?: { toolName: string; message: string; occurredAt: string };

  #dependencyChecks = new Map<string, DependencyCheck>();
  #dependencyCache = new Map<string, DependencyCheckResult>();
  #dependencyCacheTtlMs: number;
  #dependencyCacheTimestamps = new Map<string, number>();

  private constructor(options: StatusMonitorOptions) {
    this.#serviceName = options.serviceName;
    this.#serviceVersion = options.serviceVersion;
    this.#dependencyCacheTtlMs = options.dependencyCacheTtlMs ?? DEFAULT_DEPENDENCY_CACHE_TTL_MS;
  }

  get queueDepth(): number {
    return this.#activeExecutions;
  }

  get startTime(): number {
    return this.#startedAt;
  }

  updateDependencyCacheTtl(ttlMs: number): void {
    if (Number.isFinite(ttlMs) && ttlMs > 0) {
      this.#dependencyCacheTtlMs = ttlMs;
    }
  }

  registerDependency(name: string, checker: DependencyCheck): void {
    this.#dependencyChecks.set(name, checker);
  }

  recordSessionConnected(sessionId?: string): string {
    const resolvedSessionId = sessionId ?? this.#allocateAnonymousSessionId();
    if (!this.#activeSessions.has(resolvedSessionId)) {
      const now = new Date().toISOString();
      this.#activeSessions.set(resolvedSessionId, {
        sessionId: resolvedSessionId,
        connectedAt: now,
        lastSeenAt: now,
        totalExecutions: 0,
      });
      this.#totalSessions += 1;
    }
    return resolvedSessionId;
  }

  recordSessionDisconnected(sessionId?: string): void {
    const resolvedSessionId = sessionId ?? "";
    if (!resolvedSessionId) {
      return;
    }
    this.#activeSessions.delete(resolvedSessionId);
  }

  recordToolStart(context: ServerContext): void {
    this.#activeExecutions += 1;
    this.#lastActivityAt = Date.now();
    this.#touchSession(context);
  }

  recordToolSuccess(toolName: string, durationMs: number, context: ServerContext): void {
    this.#activeExecutions = Math.max(0, this.#activeExecutions - 1);
    this.#totalExecutions += 1;
    this.#totalDurationMs += durationMs;
    this.#successes += 1;
    this.#lastActivityAt = Date.now();
    this.#updateSessionExecutionCount(context);
    this.#updateToolStats(toolName, durationMs, true);
  }

  recordToolFailure(
    toolName: string,
    durationMs: number,
    error: unknown,
    context: ServerContext,
  ): void {
    this.#activeExecutions = Math.max(0, this.#activeExecutions - 1);
    this.#totalExecutions += 1;
    this.#totalDurationMs += durationMs;
    this.#failures += 1;
    this.#lastActivityAt = Date.now();
    this.#updateSessionExecutionCount(context);

    const message = error instanceof Error ? error.message : String(error);
    const occurredAt = new Date().toISOString();
    this.#lastToolError = {
      toolName,
      message,
      occurredAt,
    };

    this.#updateToolStats(toolName, durationMs, false, {
      message,
      occurredAt,
    });
  }

  #touchSession(context: ServerContext): void {
    const sessionId = context.sessionId ?? this.#allocateAnonymousSessionId();
    const existing = this.#activeSessions.get(sessionId);
    const nowIso = new Date().toISOString();
    if (existing) {
      existing.lastSeenAt = nowIso;
      if (context.session) {
        existing.tier = context.session.tier;
        existing.userId = context.session.userId;
        existing.organizationId = context.session.organizationId;
      }
    } else {
      this.#activeSessions.set(sessionId, {
        sessionId,
        connectedAt: nowIso,
        lastSeenAt: nowIso,
        tier: context.session?.tier,
        userId: context.session?.userId,
        organizationId: context.session?.organizationId,
        totalExecutions: 0,
      });
      this.#totalSessions += 1;
    }
  }

  #updateSessionExecutionCount(context: ServerContext): void {
    const sessionId = context.sessionId ?? this.#allocateAnonymousSessionId();
    const existing = this.#activeSessions.get(sessionId);
    if (existing) {
      existing.totalExecutions += 1;
      existing.lastSeenAt = new Date().toISOString();
      if (context.session) {
        existing.tier = context.session.tier;
        existing.userId = context.session.userId;
        existing.organizationId = context.session.organizationId;
      }
    } else {
      const nowIso = new Date().toISOString();
      this.#activeSessions.set(sessionId, {
        sessionId,
        connectedAt: nowIso,
        lastSeenAt: nowIso,
        tier: context.session?.tier,
        userId: context.session?.userId,
        organizationId: context.session?.organizationId,
        totalExecutions: 1,
      });
      this.#totalSessions += 1;
    }
  }

  #updateToolStats(
    toolName: string,
    durationMs: number,
    success: boolean,
    error?: { message: string; occurredAt: string },
  ): void {
    const existing = this.#toolStats.get(toolName) ?? {
      totalInvocations: 0,
      successes: 0,
      failures: 0,
      totalDurationMs: 0,
      averageDurationMs: 0,
    };

    const nextTotal = existing.totalInvocations + 1;
    const nextDurationTotal = existing.totalDurationMs + durationMs;
    const averageDurationMs = nextDurationTotal / nextTotal;

    const record: ToolExecutionRecord = {
      totalInvocations: nextTotal,
      successes: existing.successes + (success ? 1 : 0),
      failures: existing.failures + (success ? 0 : 1),
      totalDurationMs: nextDurationTotal,
      averageDurationMs,
      lastInvocationAt: new Date().toISOString(),
      lastError: error ?? existing.lastError,
    };

    this.#toolStats.set(toolName, record);
  }

  #allocateAnonymousSessionId(): string {
    this.#anonymousSessionCounter += 1;
    return `anonymous-${this.#anonymousSessionCounter}`;
  }

  #needsDependencyRefresh(name: string): boolean {
    const lastChecked = this.#dependencyCacheTimestamps.get(name);
    if (!lastChecked) {
      return true;
    }
    return Date.now() - lastChecked > this.#dependencyCacheTtlMs;
  }

  async evaluateDependencies(force = false): Promise<Record<string, DependencyCheckResult>> {
    const entries = await Promise.all(
      Array.from(this.#dependencyChecks.entries()).map(async ([name, checker]) => {
        if (!force && !this.#needsDependencyRefresh(name)) {
          return [name, this.#dependencyCache.get(name)] as const;
        }

        try {
          const result = await checker();
          this.#dependencyCache.set(name, result);
          this.#dependencyCacheTimestamps.set(name, Date.now());
          return [name, result] as const;
        } catch (error) {
          const fallback: DependencyCheckResult = {
            status: "down",
            latencyMs: 0,
            checkedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          };
          this.#dependencyCache.set(name, fallback);
          this.#dependencyCacheTimestamps.set(name, Date.now());
          return [name, fallback] as const;
        }
      }),
    );

    return Object.fromEntries(
      entries.filter((entry): entry is readonly [string, DependencyCheckResult] => Boolean(entry?.[1])),
    );
  }

  snapshot(): StatusSnapshot {
    const uptimeSeconds = (Date.now() - this.#startedAt) / 1000;
    const loadAverages = os.loadavg() as [number, number, number];
    const memoryUsage = process.memoryUsage();

    const perTool = Object.fromEntries(this.#toolStats.entries());
    const dependencies = Object.fromEntries(this.#dependencyCache.entries());

    return {
      service: {
        name: this.#serviceName,
        version: this.#serviceVersion,
        startTime: new Date(this.#startedAt).toISOString(),
        uptimeSeconds,
        pid: process.pid,
      },
      system: {
        loadAverages,
        memory: {
          rssBytes: memoryUsage.rss,
          heapTotalBytes: memoryUsage.heapTotal,
          heapUsedBytes: memoryUsage.heapUsed,
          externalBytes: memoryUsage.external,
        },
      },
      sessions: {
        active: this.#activeSessions.size,
        totalSinceStartup: this.#totalSessions,
        lastActivityAt: this.#lastActivityAt ? new Date(this.#lastActivityAt).toISOString() : undefined,
        details: Array.from(this.#activeSessions.values()).map((record) => ({
          sessionId: record.sessionId,
          tier: record.tier,
          userId: record.userId,
          organizationId: record.organizationId,
          connectedAt: record.connectedAt,
          lastSeenAt: record.lastSeenAt,
          totalExecutions: record.totalExecutions,
        })),
      },
      tools: {
        queueDepth: this.#activeExecutions,
        totalExecutions: this.#totalExecutions,
        successes: this.#successes,
        failures: this.#failures,
        averageDurationMs: this.#totalExecutions > 0 ? this.#totalDurationMs / this.#totalExecutions : 0,
        lastError: this.#lastToolError,
        perTool,
      },
      dependencies,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const initializeStatusMonitor = (options: StatusMonitorOptions): StatusMonitor => {
  return StatusMonitor.initialize(options);
};

export const getStatusMonitor = (): StatusMonitor => {
  return StatusMonitor.get();
};
