import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { WalletSchemas } from "./schemas.js";
import * as handlers from "./handlers.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type WalletSchema = (typeof WalletSchemas)[keyof typeof WalletSchemas];

type ToolAnnotations = {
  readOnlyHint?: boolean;
};

type WalletToolDefinition<Schema extends WalletSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof handlers.setProviderHandler>[1],
  ) => Promise<string>;
  annotations?: ToolAnnotations;
  timeoutMs?: number;
  requiredTier?: UsageTier;
  featureName?: string;
};

const READ_ONLY_HINT: ToolAnnotations = { readOnlyHint: true };

export const walletToolDefinitions: WalletToolDefinition<any>[] = [
  {
    name: "wallet_provider_set",
    description:
      "Set the provider URL used for subsequent wallet and provider operations within the current MCP session.",
    schema: WalletSchemas.providerSet,
    execute: handlers.setProviderHandler,
    requiredTier: "free",
  },
  {
    name: "wallet_create_random",
    description:
      "Create a new wallet with a random private key. Optionally encrypt the wallet using a password.",
    schema: WalletSchemas.createRandom,
    execute: handlers.createWalletHandler,
    requiredTier: "free",
  },
  {
    name: "wallet_from_private_key",
    description: "Create a wallet from a private key and bind it to the active provider.",
    schema: WalletSchemas.fromPrivateKey,
    execute: handlers.fromPrivateKeyHandler,
    requiredTier: "pro",
    featureName: "Wallet import from private key",
  },
  {
    name: "wallet_create_mnemonic_phrase",
    description: "Generate a mnemonic phrase using the BIP-39 wordlist.",
    schema: WalletSchemas.createMnemonicPhrase,
    execute: handlers.createMnemonicPhraseHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_from_mnemonic",
    description: "Create a wallet from a mnemonic phrase using the configured provider.",
    schema: WalletSchemas.fromMnemonic,
    execute: handlers.fromMnemonicHandler,
    requiredTier: "pro",
    featureName: "Wallet import from mnemonic",
  },
  {
    name: "wallet_from_encrypted_json",
    description: "Decrypt an encrypted JSON keystore and load it as an active wallet.",
    schema: WalletSchemas.fromEncryptedJson,
    execute: handlers.fromEncryptedJsonHandler,
    requiredTier: "pro",
    featureName: "Wallet import from encrypted JSON",
  },
  {
    name: "wallet_encrypt",
    description: "Encrypt an existing wallet using the supplied password.",
    schema: WalletSchemas.encryptWallet,
    execute: handlers.encryptWalletHandler,
    requiredTier: "pro",
    featureName: "Wallet encryption",
  },
  {
    name: "wallet_get_address",
    description: "Retrieve the address of the active wallet.",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getAddressHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_get_public_key",
    description: "Retrieve the public key of the active wallet.",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getPublicKeyHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_get_private_key",
    description: "Retrieve the private key for the active wallet (with optional password).",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getPrivateKeyHandler,
    requiredTier: "ultra",
    featureName: "Private key export",
  },
  {
    name: "wallet_get_mnemonic",
    description: "Retrieve the mnemonic phrase associated with the active wallet, if available.",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getMnemonicHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "ultra",
    featureName: "Mnemonic export",
  },
  {
    name: "wallet_get_balance",
    description: "Get the wallet balance on the configured network.",
    schema: WalletSchemas.walletWithBlockTag,
    execute: handlers.getBalanceHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_get_chain_id",
    description: "Get the chain ID of the network connected to the wallet.",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getChainIdHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_get_gas_price",
    description: "Retrieve the current gas price from the connected network.",
    schema: WalletSchemas.walletOnly,
    execute: handlers.getGasPriceHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_get_transaction_count",
    description: "Get the transaction count (nonce) for the active wallet.",
    schema: WalletSchemas.walletWithBlockTag,
    execute: handlers.getTransactionCountHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_call",
    description: "Execute a read-only contract call using the active wallet context.",
    schema: WalletSchemas.walletTransaction,
    execute: handlers.callHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_send_transaction",
    description: "Send a signed transaction via the active wallet.",
    schema: WalletSchemas.walletTransaction,
    execute: handlers.sendTransactionHandler,
    timeoutMs: 120_000,
    requiredTier: "pro",
    featureName: "Transaction broadcasting",
  },
  {
    name: "wallet_sign_transaction",
    description: "Sign a transaction payload without broadcasting it.",
    schema: WalletSchemas.walletTransaction,
    execute: handlers.signTransactionHandler,
    requiredTier: "pro",
    featureName: "Transaction signing",
  },
  {
    name: "wallet_populate_transaction",
    description: "Populate missing transaction fields (gas, nonce, etc.) using the active wallet.",
    schema: WalletSchemas.walletTransaction,
    execute: handlers.populateTransactionHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "pro",
    featureName: "Transaction preparation",
  },
  {
    name: "wallet_sign_message",
    description: "Sign an arbitrary message using the active wallet.",
    schema: WalletSchemas.walletMessage,
    execute: handlers.signMessageHandler,
    requiredTier: "pro",
    featureName: "Message signing",
  },
  {
    name: "wallet_sign_typed_data",
    description: "Sign typed EIP-712 data using the active wallet.",
    schema: WalletSchemas.walletTypedData,
    execute: handlers.signTypedDataHandler,
    requiredTier: "pro",
    featureName: "Typed data signing",
  },
  {
    name: "wallet_verify_message",
    description: "Verify a message signature against an address.",
    schema: WalletSchemas.verifyMessage,
    execute: handlers.verifyMessageHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_verify_typed_data",
    description: "Verify an EIP-712 typed data signature against an address.",
    schema: WalletSchemas.verifyTypedData,
    execute: handlers.verifyTypedDataHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "wallet_bridge_assets",
    description:
      "Bridge assets across supported chains using thirdweb bridge routes. Requires configured thirdweb credentials.",
    schema: WalletSchemas.bridgeAssets,
    execute: handlers.bridgeAssetsHandler,
    timeoutMs: 180_000,
    requiredTier: "pro",
    featureName: "Cross-chain bridge execution",
  },
  {
    name: "wallet_swap_tokens",
    description:
      "Perform on-chain token swaps via thirdweb routing on the configured network. Requires configured thirdweb credentials.",
    schema: WalletSchemas.swapTokens,
    execute: handlers.swapTokensHandler,
    timeoutMs: 120_000,
    requiredTier: "pro",
    featureName: "On-chain swap execution",
  },
  {
    name: "provider_get_block",
    description: "Retrieve block information from the configured provider.",
    schema: WalletSchemas.providerBlock,
    execute: handlers.getBlockHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_transaction",
    description: "Fetch a transaction by hash from the provider.",
    schema: WalletSchemas.providerTransactionHash,
    execute: handlers.getTransactionHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_transaction_receipt",
    description: "Fetch a transaction receipt by hash from the provider.",
    schema: WalletSchemas.providerTransactionHash,
    execute: handlers.getTransactionReceiptHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_code",
    description: "Retrieve the deployed bytecode for an address.",
    schema: WalletSchemas.providerCode,
    execute: handlers.getCodeHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_storage_at",
    description: "Inspect a storage slot for a contract address.",
    schema: WalletSchemas.providerStorage,
    execute: handlers.getStorageAtHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_estimate_gas",
    description: "Estimate the gas required for a given transaction.",
    schema: WalletSchemas.providerEstimateGas,
    execute: handlers.estimateGasHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_logs",
    description: "Query logs from the provider using a filter.",
    schema: WalletSchemas.providerFilter,
    execute: handlers.getLogsHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_get_ens_resolver",
    description: "Get the ENS resolver for a name.",
    schema: WalletSchemas.ensName,
    execute: handlers.getEnsResolverHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_lookup_address",
    description: "Lookup the ENS name for an address.",
    schema: WalletSchemas.ensAddress,
    execute: handlers.lookupAddressHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "provider_resolve_name",
    description: "Resolve an ENS name to its address.",
    schema: WalletSchemas.ensName,
    execute: handlers.resolveNameHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "network_get_network",
    description: "Get network metadata such as name and chain ID.",
    schema: WalletSchemas.noArgs,
    execute: handlers.getNetworkHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "network_get_block_number",
    description: "Fetch the latest block number from the provider.",
    schema: WalletSchemas.noArgs,
    execute: handlers.getBlockNumberHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
  {
    name: "network_get_fee_data",
    description: "Retrieve recommended gas fee data from the provider.",
    schema: WalletSchemas.noArgs,
    execute: handlers.getFeeDataHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
];

export const registerWalletModule = (server: FastMCP<ServerSessionMetadata>): void => {
  walletToolDefinitions.forEach((tool) => {
    type ToolArgs = z.infer<typeof tool.schema>;
    type ToolContext = Parameters<typeof tool.execute>[1];

    const middlewareChain = [
      tierGuardMiddleware<ToolArgs, ToolContext>({
        requiredTier: tool.requiredTier,
        featureName: tool.featureName,
      }),
      ...defaultToolMiddlewares<ToolArgs, ToolContext>(),
    ];

    const executeWithMiddleware = applyToolMiddleware<ToolArgs, ToolContext>(
      tool.name,
      tool.execute,
      middlewareChain,
    );

    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
      annotations: tool.annotations,
      timeoutMs: tool.timeoutMs,
      execute: async (args: ToolArgs, context: ToolContext) => {
        const result = await executeWithMiddleware(args, context);
        if (typeof result === "string") {
          return {
            content: [
              {
                type: "text" as const,
                text: result,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      },
    });
  });
};
