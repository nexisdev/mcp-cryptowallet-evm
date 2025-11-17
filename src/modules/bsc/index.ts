import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  applyToolMiddleware,
  defaultToolMiddlewares,
  tierGuardMiddleware,
} from "../../core/middleware.js";
import { BscSchemas } from "./schemas.js";
import {
  setBscProviderHandler,
  tokenBalanceHandler,
  transferNativeHandler,
  transferTokenHandler,
} from "./handlers.js";
import type { SessionMetadata as ServerSessionMetadata, UsageTier } from "../../server/types.js";

type ToolAnnotations = {
  readOnlyHint?: boolean;
};

type BscSchema = (typeof BscSchemas)[keyof typeof BscSchemas];

type BscToolDefinition<Schema extends BscSchema> = {
  name: string;
  description: string;
  schema: Schema;
  execute: (
    args: z.infer<Schema>,
    context: Parameters<typeof setBscProviderHandler>[1],
  ) => Promise<string>;
  annotations?: ToolAnnotations;
  requiredTier?: UsageTier;
  featureName?: string;
};

const READ_ONLY_HINT: ToolAnnotations = { readOnlyHint: true };

export const bscToolDefinitions: BscToolDefinition<any>[] = [
  {
    name: "bsc_provider_set",
    description: "Configure the BSC RPC endpoint for the current session.",
    schema: BscSchemas.providerSet,
    execute: setBscProviderHandler,
    requiredTier: "free",
  },
  {
    name: "bsc_transfer_native",
    description: "Send native BNB to a recipient address.",
    schema: BscSchemas.transferNative,
    execute: transferNativeHandler,
    requiredTier: "pro",
    featureName: "BNB transfer",
  },
  {
    name: "bsc_transfer_token",
    description: "Transfer a BEP-20 token using the provided wallet credentials.",
    schema: BscSchemas.transferToken,
    execute: transferTokenHandler,
    requiredTier: "pro",
    featureName: "BEP-20 transfer",
  },
  {
    name: "bsc_token_balance",
    description: "Fetch the BEP-20 token balance for an address.",
    schema: BscSchemas.tokenBalance,
    execute: tokenBalanceHandler,
    annotations: READ_ONLY_HINT,
    requiredTier: "free",
  },
];

export const registerBscModule = (server: FastMCP<ServerSessionMetadata>): void => {
  bscToolDefinitions.forEach((tool) => {
    type ToolArgs = z.infer<typeof tool.schema>;
    type ToolContext = Parameters<typeof tool.execute>[1];

    const middlewares = [
      tierGuardMiddleware<ToolArgs, ToolContext>({
        requiredTier: tool.requiredTier,
        featureName: tool.featureName,
      }),
      ...defaultToolMiddlewares<ToolArgs, ToolContext>(),
    ];

    const executeWithMiddleware = applyToolMiddleware<ToolArgs, ToolContext>(
      tool.name,
      tool.execute,
      middlewares,
    );

    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
      annotations: tool.annotations,
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
