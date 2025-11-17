import { FastMCP, UserError } from "fastmcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  Tool as RemoteToolDescriptor,
  Prompt as RemotePromptDescriptor,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { Content } from "fastmcp";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SessionMetadata } from "../../server/types.js";
import { applyToolMiddleware, defaultToolMiddlewares } from "../../core/middleware.js";
import type { RemoteServerConfig } from "../../core/config.js";
import type { AppLogger } from "../../core/logging.js";

export type RemoteRegistrationOutcome =
  | {
      status: "registered";
      serverId: string;
      label: string;
      toolCount: number;
      promptCount: number;
    }
  | {
      status: "skipped";
      serverId: string;
      label: string;
      reason: string;
    };

type RemoteClientHandle = {
  client: Client;
  transport: StreamableHTTPClientTransport;
  config: RemoteServerConfig;
};

const parseUrl = (rawUrl: string, serverId: string): URL => {
  try {
    return new URL(rawUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid URL for remote server ${serverId}: ${message}`);
  }
};

const buildHeaders = (config: RemoteServerConfig): HeadersInit | undefined => {
  if (!config.headers) {
    return undefined;
  }
  return { ...config.headers };
};

const createRemoteClient = async (
  config: RemoteServerConfig,
  logger: AppLogger,
): Promise<RemoteClientHandle> => {
  const endpoint = parseUrl(config.baseUrl, config.id);
  const headers = buildHeaders(config);
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: headers ? { headers } : undefined,
  });

  const client = new Client({
    name: `mcp-cryptowallet-evm-${config.id}`,
    version: "2.1.0",
  });

  try {
    await client.connect(transport);
    logger.info(
      {
        remoteServer: config.id,
        url: endpoint.toString(),
      },
      "[remote] connected to MCP server",
    );
    return { client, transport, config };
  } catch (error) {
    await transport.close().catch(() => {
      // ignore transport close failure on initialization error
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to connect to remote MCP server ${config.id}: ${message}`,
    );
  }
};

const asStandardSchema = (
  schema: RemoteToolDescriptor["inputSchema"],
): StandardSchemaV1 => {
  return schema as unknown as StandardSchemaV1;
};

const renderContent = (content: Content[]): string => {
  if (content.length === 0) {
    return "";
  }

  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    } else if (block.type === "image" || block.type === "audio") {
      parts.push(
        JSON.stringify(
          {
            type: block.type,
            mimeType: block.mimeType,
            size: block.data?.length ?? 0,
          },
          null,
          2,
        ),
      );
    } else if (block.type === "resource") {
      parts.push(JSON.stringify(block.resource, null, 2));
    } else {
      parts.push(JSON.stringify(block, null, 2));
    }
  }

  return parts.join("\n\n");
};

const adaptToolName = (prefix: string, name: string): string => {
  const normalizedPrefix = prefix.endsWith("_")
    ? prefix.slice(0, -1)
    : prefix;
  return `${normalizedPrefix}_${name}`.replace(/\s+/g, "_").toLowerCase();
};

const describeTool = (
  tool: RemoteToolDescriptor,
  config: RemoteServerConfig,
): string => {
  const fragments = [
    tool.description ?? "Proxied remote tool.",
    `(via ${config.label})`,
  ];
  if (config.tags?.length) {
    fragments.push(`[tags: ${config.tags.join(", ")}]`);
  }
  return fragments.join(" ");
};

const registerRemoteTool = (
  server: FastMCP<SessionMetadata>,
  handle: RemoteClientHandle,
  tool: RemoteToolDescriptor,
  logger: AppLogger,
) => {
  type ToolArgs = Record<string, unknown>;

  const proxiedName = adaptToolName(handle.config.toolPrefix, tool.name);

  const executeWithMiddleware = applyToolMiddleware<ToolArgs>(
    proxiedName,
    async (args, context) => {
      try {
        const result = (await handle.client.callTool({
          name: tool.name,
          arguments: args,
        })) as CallToolResult;

        const remoteContent = Array.isArray(result.content)
          ? (result.content as unknown as Content[])
          : [];

        if (result.isError) {
          const structured = result.structuredContent;
          const structuredMessage =
            structured &&
            typeof structured === "object" &&
            "message" in structured &&
            typeof (structured as { message?: unknown }).message === "string"
              ? (structured as { message?: string }).message
              : undefined;
          const fallbackMessage =
            remoteContent.length > 0 ? renderContent(remoteContent) : undefined;

          throw new UserError(
            structuredMessage ??
              fallbackMessage ??
              `Remote tool ${tool.name} returned an error.`,
          );
        }

        if (result.structuredContent) {
          return JSON.stringify(result.structuredContent, null, 2);
        }

        if (remoteContent.length > 0) {
          const rendered = renderContent(remoteContent);
          return rendered.length > 0
            ? rendered
            : "Remote tool executed successfully but returned non-text content.";
        }

        return "Remote tool executed successfully but returned no content.";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            remoteServer: handle.config.id,
            tool: tool.name,
            error: message,
            requestId: context.requestId,
          },
          "[remote] tool invocation failed",
        );
        throw new UserError(
          `Remote tool ${tool.name} failed: ${message}`,
        );
      }
    },
    defaultToolMiddlewares<ToolArgs>(),
  );

  server.addTool({
    name: proxiedName,
    description: describeTool(tool, handle.config),
    annotations: tool.annotations,
    parameters: asStandardSchema(tool.inputSchema),
    execute: async (args: unknown, context) =>
      executeWithMiddleware(args as ToolArgs, context),
  });
};

const registerRemotePrompt = (
  server: FastMCP<SessionMetadata>,
  handle: RemoteClientHandle,
  prompt: RemotePromptDescriptor,
  logger: AppLogger,
) => {
  const proxiedName = adaptToolName(handle.config.toolPrefix, prompt.name);

  server.addPrompt({
    name: proxiedName,
    description:
      `${prompt.description ?? "Proxied prompt."} (via ${handle.config.label})`,
    arguments: prompt.arguments?.map((argument) => ({
      ...argument,
      required: argument.required ?? false,
    })),
    load: async (args) => {
      const filteredArgs = Object.entries(args).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === "string" && value.length > 0) {
            acc[key] = value;
          }
          return acc;
        },
        {},
      );

      try {
        const result = await handle.client.getPrompt({
          name: prompt.name,
          arguments: Object.keys(filteredArgs).length ? filteredArgs : undefined,
        });

        const segments: string[] = [];
        if (result.description) {
          segments.push(result.description);
        }
        for (const message of result.messages) {
          segments.push(
            renderContent([message.content as unknown as Content]),
          );
        }
        return segments.filter((segment) => segment.length > 0).join("\n\n");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            remoteServer: handle.config.id,
            prompt: prompt.name,
            error: message,
          },
          "[remote] prompt load failed",
        );
        throw new UserError(
          `Remote prompt ${prompt.name} failed to load: ${message}`,
        );
      }
    },
  });
};

export const registerRemoteServers = async (
  server: FastMCP<SessionMetadata>,
  logger: AppLogger,
  configs: RemoteServerConfig[],
): Promise<RemoteRegistrationOutcome[]> => {
  if (configs.length === 0) {
    return [];
  }

  const outcomes: RemoteRegistrationOutcome[] = [];

  for (const config of configs) {
    try {
      const handle = await createRemoteClient(config, logger);
      const toolsResult = await handle.client.listTools({});
      const tools = toolsResult.tools ?? [];

      tools.forEach((tool) => registerRemoteTool(server, handle, tool, logger));

      let promptsRegistered = 0;
      try {
        const promptResult = await handle.client.listPrompts({});
        const prompts = promptResult.prompts ?? [];
        prompts.forEach((prompt) =>
          registerRemotePrompt(server, handle, prompt, logger),
        );
        promptsRegistered = prompts.length;
      } catch (promptError) {
        const message =
          promptError instanceof Error ? promptError.message : String(promptError);
        logger.warn(
          {
            remoteServer: config.id,
            error: message,
          },
          "[remote] prompt synchronization failed",
        );
      }

      outcomes.push({
        status: "registered",
        serverId: config.id,
        label: config.label,
        toolCount: tools.length,
        promptCount: promptsRegistered,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        {
          remoteServer: config.id,
          url: config.baseUrl,
          error: message,
        },
        "[remote] integration skipped",
      );
      outcomes.push({
        status: "skipped",
        serverId: config.id,
        label: config.label,
        reason: message,
      });
    }
  }

  return outcomes;
};
