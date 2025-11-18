import { randomUUID } from "crypto";
import { UserError } from "fastmcp";
import type { ContentResult } from "fastmcp";
import { persistSessionMetadata, recordToolUsage } from "./sessionStore.js";
import { getStatusMonitor } from "../server/status/statusMonitor.js";
import type { ServerContext, UsageTier } from "../server/types.js";

export type ToolResult = string | (ContentResult & { structuredContent?: Record<string, unknown> });

type GenericContext = ServerContext;

const asString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

export type ToolExecution<TArgs, TContext extends GenericContext = GenericContext> = (
  args: TArgs,
  context: TContext,
) => Promise<ToolResult>;

export type ToolMiddleware<TArgs, TContext extends GenericContext = GenericContext> = (params: {
  name: string;
  args: TArgs;
  context: TContext;
  next: () => Promise<ToolResult>;
}) => Promise<ToolResult>;

type MiddlewareParams<TArgs, TContext extends GenericContext> = Parameters<
  ToolMiddleware<TArgs, TContext>
>[0];

export const applyToolMiddleware = <
  TArgs,
  TContext extends GenericContext = GenericContext,
>(
  name: string,
  execute: ToolExecution<TArgs, TContext>,
  middlewares: ToolMiddleware<TArgs, TContext>[],
): ToolExecution<TArgs, TContext> => {
  return async (args: TArgs, context: TContext) => {
    let index = -1;

    const dispatch = async (i: number): Promise<ToolResult> => {
      if (i <= index) {
        throw new Error("next() called multiple times in middleware pipeline.");
      }
      index = i;

      const middleware = middlewares[i];
      if (!middleware) {
        return execute(args, context);
      }

      return middleware({
        name,
        args,
        context,
        next: () => dispatch(i + 1),
      });
    };

    return dispatch(0);
  };
};

export const normalizeStringArgsMiddleware = <
  TArgs,
  TContext extends GenericContext = GenericContext,
>(): ToolMiddleware<TArgs, TContext> => {
  return async ({ args, next }: MiddlewareParams<TArgs, TContext>) => {
    if (args && typeof args === "object" && !Array.isArray(args)) {
      Object.entries(args as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === "string") {
          (args as Record<string, unknown>)[key] = value.trim();
        }
      });
    }
    return next();
  };
};

export const telemetryMiddleware = <TArgs, TContext extends GenericContext = GenericContext>(): ToolMiddleware<
  TArgs,
  TContext
> => {
  return async ({ name, args, context, next }: MiddlewareParams<TArgs, TContext>) => {
    const start = Date.now();
    const correlationId = context.requestId ?? randomUUID();
    const SENSITIVE_KEYS = [
      "password",
      "privatekey",
      "mnemonic",
      "seed",
      "secret",
      "apikey",
      "accesskey",
      "token",
    ];
    const redactedArgs = JSON.stringify(args, (key, value) => {
      if (typeof value === "string") {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
          return "[redacted]";
        }
        if (value.length > 8 && /^[0-9a-fx]+$/i.test(value) && lowerKey.includes("key")) {
          return "[redacted]";
        }
      }
      return value;
    });

    const userId = asString(context.session?.userId);
    const organizationId = asString(context.session?.organizationId);
    const tier = asString(context.session?.tier);

    context.log.info(`[tool] ${name} invoked`, {
      requestId: correlationId,
      tool: name,
      userId,
      organizationId,
      tier,
      args: redactedArgs,
    });

    try {
      const result = await next();
      const durationMs = Date.now() - start;
      context.log.info(`[tool] ${name} completed`, {
        requestId: correlationId,
        tool: name,
        userId,
        organizationId,
        tier,
        durationMs,
      });
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      context.log.error(`[tool] ${name} failed`, {
        requestId: correlationId,
        tool: name,
        userId,
        organizationId,
        tier,
        durationMs,
        error: message,
      });
      throw error;
    }
  };
};

export const metricsMiddleware = <TArgs, TContext extends GenericContext = GenericContext>(): ToolMiddleware<
  TArgs,
  TContext
> => {
  return async ({ name, context, next }: MiddlewareParams<TArgs, TContext>) => {
    const start = Date.now();
    const tier = asString(context.session?.tier);
    const sessionId = context.sessionId;

    try {
      const result = await next();
      const duration = Date.now() - start;

      await recordToolUsage(context, name, duration, true).catch((error: unknown) => {
        context.log.warn("[metrics] Failed to record tool usage", {
          tool: name,
          error: error instanceof Error ? error.message : String(error),
          tier,
          sessionId,
        });
      });
      if (sessionId) {
        void persistSessionMetadata(
          {
            sessionId,
            tier: context.session?.tier ?? "free",
            userId: context.session?.userId,
            organizationId: context.session?.organizationId,
          },
          "disconnect",
        ).catch((error: unknown) => {
          context.log.warn("[metrics] Failed to persist session heartbeat", {
            tool: name,
            error: error instanceof Error ? error.message : String(error),
            sessionId,
          });
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      await recordToolUsage(context, name, duration, false).catch((storageError: unknown) => {
        context.log.warn("[metrics] Failed to record failed tool usage", {
          tool: name,
          error: storageError instanceof Error ? storageError.message : String(storageError),
          tier,
          sessionId,
        });
      });

      if (sessionId) {
        void persistSessionMetadata(
          {
            sessionId,
            tier: context.session?.tier ?? "free",
            userId: context.session?.userId,
            organizationId: context.session?.organizationId,
          },
          "disconnect",
        ).catch((storageError: unknown) => {
          context.log.warn("[metrics] Failed to persist failed session heartbeat", {
            tool: name,
            error:
              storageError instanceof Error ? storageError.message : String(storageError),
            sessionId,
          });
        });
      }

      throw error;
    }
  };
};

const tierOrdering: Record<UsageTier, number> = {
  free: 0,
  pro: 1,
  ultra: 2,
};

export const tierGuardMiddleware = <
  TArgs,
  TContext extends GenericContext = GenericContext,
>(
  options: {
    requiredTier?: UsageTier;
    featureName?: string;
  } = {},
): ToolMiddleware<TArgs, TContext> => {
  const { requiredTier, featureName } = options;

  return async ({ name, context, next }: MiddlewareParams<TArgs, TContext>) => {
    if (!requiredTier) {
      return next();
    }

    const sessionTier: UsageTier = context.session?.tier ?? "free";
    const sessionRank = tierOrdering[sessionTier] ?? 0;
    const requiredRank = tierOrdering[requiredTier] ?? 0;

    if (sessionRank < requiredRank) {
      const userId = asString(context.session?.userId);
      const organizationId = asString(context.session?.organizationId);
      const sessionId = context.sessionId;

      context.log.warn("[tier] access denied", {
        tool: name,
        featureName,
        sessionTier,
        requiredTier,
        userId,
        organizationId,
        sessionId,
      });

      const reason = featureName ?? `Tool ${name}`;
      throw new UserError(`${reason} requires tier "${requiredTier}". Current tier: "${sessionTier}".`);
    }

    return next();
  };
};

export const statusMetricsMiddleware = <
  TArgs,
  TContext extends GenericContext = GenericContext,
>(): ToolMiddleware<TArgs, TContext> => {
  return async ({ name, context, next }: MiddlewareParams<TArgs, TContext>) => {
    const monitor = getStatusMonitor();
    const start = Date.now();
    monitor.recordToolStart(context);

    try {
      const result = await next();
      monitor.recordToolSuccess(name, Date.now() - start, context);
      return result;
    } catch (error) {
      monitor.recordToolFailure(name, Date.now() - start, error, context);
      throw error;
    }
  };
};

export const errorBoundaryMiddleware = <TArgs, TContext extends GenericContext = GenericContext>(): ToolMiddleware<
  TArgs,
  TContext
> => {
  return async ({ name, context, next }: MiddlewareParams<TArgs, TContext>) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      context.log.error("[tool] unexpected failure", {
        tool: name,
        error: message,
      });
      throw new UserError(`Tool ${name} failed unexpectedly: ${message}`);
    }
  };
};

export const progressSafetyMiddleware = <TArgs, TContext extends GenericContext = GenericContext>(): ToolMiddleware<
  TArgs,
  TContext
> => {
  return async ({ context, next }: MiddlewareParams<TArgs, TContext>) => {
    try {
      await context.reportProgress({ progress: 5, total: 100 });
    } catch {
      // Ignore progress errors; clients may not supply a progress token.
    }

    const result = await next();

    try {
      await context.reportProgress({ progress: 100, total: 100 });
    } catch {
      // Ignore progress errors; clients may not supply a progress token.
    }

    return result;
  };
};

export const defaultToolMiddlewares = <TArgs, TContext extends GenericContext = GenericContext>(): ToolMiddleware<
  TArgs,
  TContext
>[] => [
  normalizeStringArgsMiddleware<TArgs, TContext>(),
  statusMetricsMiddleware<TArgs, TContext>(),
  telemetryMiddleware<TArgs, TContext>(),
  metricsMiddleware<TArgs, TContext>(),
  progressSafetyMiddleware<TArgs, TContext>(),
  errorBoundaryMiddleware<TArgs, TContext>(),
];
