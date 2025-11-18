import { Context } from "fastmcp";
import type { SessionMetadata } from "../server/types.js";
import { getRuntime } from "./runtime.js";

type SessionContext = Context<Record<string, unknown> | undefined>;

const DEFAULT_SESSION_KEY = "stdio";
const TOOL_USAGE_SCOPE = "tool-usage";
const SESSION_METADATA_SCOPE = "session-metadata";

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

const sanitizeSegment = (value: string): string => {
  return value.replace(/[^a-z0-9._-]/gi, "-");
};

const resolveSessionKey = (context: SessionContext, scope: string, key: string) => {
  const sessionSegment = context.sessionId ?? DEFAULT_SESSION_KEY;
  const tenantCandidate =
    context.session?.organizationId ?? context.session?.userId;
  const tenantSegment = tenantCandidate ? String(tenantCandidate) : "anonymous";
  return `${scope}:${sanitizeSegment(tenantSegment)}:${sanitizeSegment(sessionSegment)}:${key}`;
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

type StoredSessionMetadata = {
  sessionId: string;
  userId?: string;
  organizationId?: string;
  tier: SessionMetadata["tier"];
  connectedAt: string;
  lastSeenAt: string;
};

const sessionMetadataKey = (sessionId: string): string => {
  return `${SESSION_METADATA_SCOPE}:${sessionId}`;
};

export const persistSessionMetadata = async (
  session: Pick<SessionMetadata, "tier" | "userId" | "organizationId"> & { sessionId: string },
  event: "connect" | "disconnect",
): Promise<void> => {
  const now = new Date().toISOString();
  const storage = withStorage();
  const key = sessionMetadataKey(session.sessionId);

  const existing = await storage.get<StoredSessionMetadata>(key);
  const connectedAt = existing?.connectedAt ?? now;

  const payload: StoredSessionMetadata = {
    sessionId: session.sessionId,
    tier: session.tier,
    userId: session.userId,
    organizationId: session.organizationId,
    connectedAt: event === "connect" ? now : connectedAt,
    lastSeenAt: now,
  };

  await storage.set(key, payload, 1000 * 60 * 60 * 6);
};

export const getPersistedSessionMetadata = async (
  sessionId: string,
): Promise<StoredSessionMetadata | null> => {
  const storage = withStorage();
  return storage.get<StoredSessionMetadata>(sessionMetadataKey(sessionId));
};
