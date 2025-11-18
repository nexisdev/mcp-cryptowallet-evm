# FastMCP Connector Reference

This guide summarises how to expose the FastMCP crypto wallet server to downstream AI platforms.

---

## 1. ChatGPT (Developer Mode)

1. Enable **Developer Mode** in ChatGPT → Settings → Connectors.
2. Create a connector:
   - **Name**: `mcp-cryptowallet`
   - **Server URL**: `https://your-domain.example/mcp/`
   - **Require approval**: `never`
   - Optional headers:
     ```json
     {
       "Authorization": "Bearer YOUR_TOKEN"
     }
     ```
3. Start a new chat, press **+ → Developer Mode**, enable the connector.

### Deep Research Requirements

- Ensure the connector exposes `wormhole_route_status` or other read-only tools as `search`/`fetch` equivalents if needed.
- Add caching middleware (already provided) to avoid rate-limit friction.

---

## 2. OpenAI Responses API

```ts
import { OpenAI } from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  tools: [
    {
      type: "mcp",
      server_label: "crypto_wallet",
      server_url: "https://your-domain.example/mcp/",
      require_approval: "never",
      headers: {
        Authorization: `Bearer ${process.env.MCP_TOKEN}`,
      },
    },
  ],
  input: "Bridge 25 USDC from Ethereum to BSC.",
});
```

---

## 3. Claude Desktop / Cursor

Update your MCP config file:

```json
{
  "mcpServers": {
    "mcp-cryptowallet": {
      "command": "npm",
      "args": ["run", "start"],
      "cwd": "/absolute/path/to/mcp-cryptowallet-evm",
      "env": {
        "PROVIDER_URL": "https://eth.llamarpc.com",
        "BSC_PROVIDER_URL": "https://bsc-dataseed.binance.org",
        "WORMHOLE_ENDPOINT": "https://api.testnet.wormhole.com"
      }
    }
  }
}
```

Restart the client to pick up the new server.

---

## 4. Health & Observability

- HTTP transport exposes `/mcp` (JSON-RPC), `/sse` (SSE), and optional `/health` endpoints (configure in `startServer.ts`).
- Telemetry middleware sends per-tool logs via FastMCP logging messages; surface them in your connector or log sink.

---

## 5. Security Notes

- Gate HTTP access behind a reverse proxy and terminate TLS there.
- Use Bearer tokens or JWT verification (FastMCP `auth` config) when exposing the server publicly.
- Never ship private keys inside MCP prompts or connector metadata.

