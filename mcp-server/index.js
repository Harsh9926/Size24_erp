import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const API_BASE  = "https://shopsize24.in/api";
const MCP_SECRET = "size24-mcp-2026";

const server = new McpServer({
    name: "SIZE24 ERP",
    version: "1.0.0",
});

server.tool(
    "get_erp_data",
    "SIZE24 ERP ka aaj ka live business data fetch karo — sales, cash, wallet balances, manager funds, transfers sab kuch",
    {},
    async () => {
        const res = await fetch(`${API_BASE}/mcp/context`, {
            headers: { Authorization: `Bearer ${MCP_SECRET}` },
        });
        if (!res.ok) {
            throw new Error(`ERP server error: ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        return { content: [{ type: "text", text }] };
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);
