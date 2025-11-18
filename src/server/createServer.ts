import { FastMCP } from "fastmcp";
import { loadConfig, type AppConfig, type RemoteServerConfig } from "../core/config.js";
import { initializeRuntime } from "../core/runtime.js";
import { registerWalletModule } from "../modules/wallet/index.js";
import { registerBscModule } from "../modules/bsc/index.js";
import { registerPrompts } from "../prompts/index.js";
import { registerWormholeModule } from "../modules/wormhole/index.js";
import { registerDebankModule } from "../modules/debank/index.js";
import { registerCryptoPanicModule } from "../modules/cryptopanic/index.js";
import { registerWeb3ResearchModule } from "../modules/web3research/index.js";
import { registerCryptoProjectsModule } from "../modules/cryptoprojects/index.js";
import { registerPumpSwapModule } from "../modules/pumpswap/index.js";
import { registerAaveModule } from "../modules/aave/index.js";
import { registerDefiModule } from "../modules/defi/index.js";
import type { SessionMetadata } from "./types.js";
import { createAuthenticator } from "./auth.js";
import { registerAsterModule } from "../modules/aster/index.js";
import { registerRemoteServers } from "../modules/remote/index.js";
import { initializeStatusMonitor } from "./status/statusMonitor.js";
import { registerDefaultDependencies } from "./status/dependencies.js";
import { persistSessionMetadata } from "../core/sessionStore.js";

export const createServer = async (): Promise<FastMCP<SessionMetadata>> => {
  const runtime = initializeRuntime();
  const config: AppConfig = loadConfig();
  const remoteServerConfigs: ReadonlyArray<RemoteServerConfig> = config.remoteServers;

  const serviceName = "mcp-cryptowallet-evm-fastmcp";
  const serviceVersion = "2.1.0";
  const monitor = initializeStatusMonitor({
    serviceName,
    serviceVersion,
  });
  registerDefaultDependencies(monitor, runtime.storage);

  const server = new FastMCP<SessionMetadata>({
    name: serviceName,
    version: serviceVersion,
    instructions: [
      "This server exposes EVM wallet management, bridging, DeFi research, and on-chain analytics tools.",
      "Use provider_set tools to configure RPC or API credentials before invoking stateful actions.",
      "Read-only tools are annotated with readOnlyHint=true for safe composition.",
    ].join(" "),
    logger: runtime.logger,
    authenticate: createAuthenticator(config, runtime),
    health: {
      enabled: true,
      path: "/health",
      message: "ok",
    },
  });

  registerWalletModule(server);
  registerBscModule(server);
  registerWormholeModule(server);
  registerAaveModule(server);
  registerAsterModule(server);
  registerDebankModule(server);
  registerDefiModule(server);
  registerCryptoPanicModule(server);
  registerWeb3ResearchModule(server);
  registerCryptoProjectsModule(server);
  registerPumpSwapModule(server);
  registerPrompts(server);

  server.on("connect", ({ session }) => {
    const originalSessionId = session.sessionId;
    const resolvedSessionId = monitor.recordSessionConnected(originalSessionId);
    if (!originalSessionId) {
      session.sessionId = resolvedSessionId;
    }
    if (session.sessionId) {
      void persistSessionMetadata(
        {
          sessionId: session.sessionId,
          tier: config.defaultTier,
        },
        "connect",
      ).catch((error: unknown) => {
        runtime.logger.warn(
          {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "[session] failed to persist connection metadata",
        );
      });
    }
    runtime.logger.debug(
      {
        sessionId: resolvedSessionId,
      },
      "[session] connected",
    );
  });

  server.on("disconnect", ({ session }) => {
    monitor.recordSessionDisconnected(session.sessionId);
    if (session.sessionId) {
      void persistSessionMetadata(
        {
          sessionId: session.sessionId,
          tier: config.defaultTier,
        },
        "disconnect",
      ).catch((error: unknown) => {
        runtime.logger.warn(
          {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "[session] failed to persist disconnect metadata",
        );
      });
    }
    runtime.logger.debug(
      {
        sessionId: session.sessionId,
      },
      "[session] disconnected",
    );
  });

  const {
    outcomes: remoteOutcomes,
    dispose: disposeRemoteClients,
  } = await registerRemoteServers(
    server,
    runtime.logger,
    remoteServerConfigs,
  );

  const ensureRemoteDisposed = (() => {
    let invoked = false;
    return async (): Promise<void> => {
      if (invoked) {
        return;
      }
      invoked = true;
      await disposeRemoteClients();
    };
  })();

  const logDisposalFailure = (hook: string, error: unknown): void => {
    const details =
      error instanceof Error
        ? {
            message: error.message,
            ...(error.stack ? { stack: error.stack } : {}),
          }
        : { message: String(error) };
    runtime.logger.error(
      {
        hook,
        ...details,
      },
      "[remote] disposal failed",
    );
  };

  process.once("beforeExit", () => {
    void ensureRemoteDisposed().catch((error) => logDisposalFailure("beforeExit", error));
  });
  process.once("exit", () => {
    void ensureRemoteDisposed().catch((error) => logDisposalFailure("exit", error));
  });
  (["SIGINT", "SIGTERM"] as const).forEach((signal) => {
    process.once(signal, () => {
      void ensureRemoteDisposed().catch((error) => logDisposalFailure(signal, error));
    });
  });

  const originalStop = server.stop.bind(server);
  server.stop = async () => {
    await ensureRemoteDisposed();
    await originalStop();
  };

  remoteOutcomes.forEach((outcome) => {
    if (outcome.status === "registered") {
      runtime.logger.info(
        {
          remoteServer: outcome.serverId,
          tools: outcome.toolCount,
          prompts: outcome.promptCount,
        },
        "[remote] integration completed",
      );
    } else {
      runtime.logger.warn(
        {
          remoteServer: outcome.serverId,
          reason: outcome.reason,
        },
        "[remote] integration skipped",
      );
    }
  });

  return server;
};
