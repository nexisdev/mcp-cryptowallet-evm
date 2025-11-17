import { Context } from "fastmcp";
import { getRuntime } from "./runtime.js";

type SessionContext = Context<Record<string, unknown> | undefined>;

const DEFAULT_SESSION_KEY = "stdio";
const TOOL_USAGE_SCOPE = "tool-usage";

type StorageValue<T> = {
  value: T;
  updatedAt: string;
};

export type ToolUsageSnapshot = {
  totalInvocations: number;
  successes: number;
  failures: number;
  averageDurationMs: number;
  lastInvocation?: string;
};

export type ToolUsageMetrics = {
  totalInvocations: number;
  tools: Record<string, ToolUsageSnapshot>;
};

const defaultUsage: ToolUsageMetrics = {
  totalInvocations: 0,
  tools: {},
};

const resolveSessionKey = (context: SessionContext, scope: string, key: string) => {
  const sessionSegment = context.sessionId ?? DEFAULT_SESSION_KEY;
  return `${scope}:${sessionSegment}:${key}`;
};

const withStorage = () => getRuntime().storage;

export const getSessionData = async <T>(
  context: SessionContext,
  scope: string,
  key: string,
): Promise<T | undefined> => {
  const storageKey = resolveSessionKey(context, scope, key);
  const record = await withStorage().get<StorageValue<T>>(storageKey);
  return record?.value;
};

export const setSessionData = async <T>(
  context: SessionContext,
  scope: string,
  key: string,
  value: T,
  ttlMs?: number,
): Promise<void> => {
  const storageKey = resolveSessionKey(context, scope, key);
  await withStorage().set(storageKey, { value, updatedAt: new Date().toISOString() }, ttlMs);
};

export const updateSessionData = async <T>(
  context: SessionContext,
  scope: string,
  key: string,
  updater: (current: T | undefined) => T,
  ttlMs?: number,
): Promise<T> => {
  const current = await getSessionData<T>(context, scope, key);
  const next = updater(current);
  await setSessionData(context, scope, key, next, ttlMs);
  return next;
};

const computeAverage = (prevAverage: number, total: number, sample: number) => {
  if (total <= 1) {
    return sample;
  }
  const previousCount = total - 1;
  return ((prevAverage * previousCount) + sample) / total;
};

export const recordToolUsage = async (
  context: SessionContext,
  toolName: string,
  durationMs: number,
  success: boolean,
): Promise<ToolUsageSnapshot> => {
  const metrics = await updateSessionData<ToolUsageMetrics>(
    context,
    TOOL_USAGE_SCOPE,
    "session",
    (current = defaultUsage) => {
      const snapshot = {
        totalInvocations: current.totalInvocations + 1,
        tools: { ...current.tools },
      };

      const existing = current.tools[toolName] ?? {
        totalInvocations: 0,
        successes: 0,
        failures: 0,
        averageDurationMs: 0,
      };

      const nextTotal = existing.totalInvocations + 1;
      const nextSnapshot: ToolUsageSnapshot = {
        totalInvocations: nextTotal,
        successes: existing.successes + (success ? 1 : 0),
        failures: existing.failures + (success ? 0 : 1),
        averageDurationMs: computeAverage(existing.averageDurationMs, nextTotal, durationMs),
        lastInvocation: new Date().toISOString(),
      };

      snapshot.tools[toolName] = nextSnapshot;
      return snapshot;
    },
  );

  return metrics.tools[toolName];
};

export const getToolUsageSnapshot = async (
  context: SessionContext,
  toolName: string,
): Promise<ToolUsageSnapshot | undefined> => {
  const metrics = await getSessionData<ToolUsageMetrics>(
    context,
    TOOL_USAGE_SCOPE,
    "session",
  );
  return metrics?.tools[toolName];
};
