import { FastMCP } from "fastmcp";
import { loadConfig, type AppConfig } from "../core/config.js";
import type { RemoteServerConfig } from "../core/config.js";
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

export const createServer = async (): Promise<FastMCP<SessionMetadata>> => {
  const runtime = initializeRuntime();
  const config: AppConfig = loadConfig();

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
    runtime.logger.debug(
      {
        sessionId: resolvedSessionId,
      },
      "[session] connected",
    );
  });

  server.on("disconnect", ({ session }) => {
    monitor.recordSessionDisconnected(session.sessionId);
    runtime.logger.debug(
      {
        sessionId: session.sessionId,
      },
      "[session] disconnected",
    );
  });

  const remoteOutcomes = await registerRemoteServers(
    server,
    runtime.logger,
    config.remoteServers as RemoteServerConfig[],
  );

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
