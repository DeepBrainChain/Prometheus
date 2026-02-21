/**
 * Communication capability - interact with external APIs, agents, forums.
 * Registered as OpenClaw tools: comm_call_api, comm_discover_agents,
 *   comm_propose_investment, comm_negotiate_service
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerCommunicatorTools(ctx: PrometheusContext): void {
  const { api, journal, stateStore } = ctx;

  api.registerTool({
    name: "comm_call_api",
    label: "Call External API",
    description: "Make an HTTP request to any external API. General-purpose communication tool.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "API endpoint URL" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"], description: "HTTP method" },
        headers: { type: "string", description: "JSON-encoded headers object" },
        body: { type: "string", description: "JSON-encoded request body" },
      },
      required: ["url"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const url = params.url as string;
      const method = (params.method as string) || "GET";
      const headers = params.headers ? JSON.parse(params.headers as string) : {};
      const body = params.body ? JSON.parse(params.body as string) : undefined;

      try {
        const resp = await httpRequest(url, {
          method: method as any,
          headers,
          body,
          timeoutMs: 30_000,
        });

        journal.append({
          tick: stateStore.get().total_ticks,
          type: "action_result",
          action: "comm_call_api",
          success: resp.ok,
          details: { url, method, status: resp.status },
        });

        const responseText = typeof resp.data === "string"
          ? resp.data.slice(0, 3000)
          : JSON.stringify(resp.data, null, 2).slice(0, 3000);

        return {
          details: {}, content: [
            {
              type: "text",
              text: `HTTP ${method} ${url}\nStatus: ${resp.status}\n\nResponse:\n${responseText}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `API call error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "comm_discover_agents",
    label: "Discover Agents",
    description:
      "Discover other AI agents on-chain. Looks for known agent registries and on-chain activity patterns.",
    parameters: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["base", "dbc"], description: "Which chain to scan" },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      // Scan for known agent registries / protocols
      const agents: Array<{ address: string; name: string; type: string }> = [];

      try {
        // Check DexScreener for agent-like tokens on Base
        const resp = await httpRequest<any>(
          "https://api.dexscreener.com/latest/dex/search?q=AI+Agent",
          { timeoutMs: 10_000 },
        );

        if (resp.ok && resp.data?.pairs) {
          for (const pair of resp.data.pairs.slice(0, 10)) {
            if (pair.chainId === "base") {
              agents.push({
                address: pair.baseToken?.address || "",
                name: pair.baseToken?.name || "Unknown",
                type: "token",
              });
            }
          }
        }
      } catch {
        // continue
      }

      const state = stateStore.get();
      // Add any known agents from state
      for (const addr of state.relationships.known_agents) {
        agents.push({ address: addr, name: "Known Agent", type: "registered" });
      }

      const lines = agents.length > 0
        ? agents.map((a) => `  ${a.name} (${a.type}): ${a.address}`).join("\n")
        : "  No agents discovered yet.";

      return {
        details: {}, content: [{ type: "text", text: `Discovered Agents:\n${lines}` }],
      };
    },
  });

  api.registerTool({
    name: "comm_propose_investment",
    label: "Propose Investment",
    description: "Send an investment proposal to another agent or entity. Include a pitch for collaboration.",
    parameters: {
      type: "object",
      properties: {
        target_address: { type: "string", description: "Target agent/entity address" },
        pitch: { type: "string", description: "Investment/collaboration pitch" },
        offer: { type: "string", description: "What you're offering (tokens, services, etc.)" },
        ask: { type: "string", description: "What you're asking for" },
      },
      required: ["target_address", "pitch"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      journal.append({
        tick: stateStore.get().total_ticks,
        type: "ceo_decision",
        action: "comm_propose_investment",
        params: params as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Investment proposal prepared:\n` +
              `  Target: ${params.target_address}\n` +
              `  Pitch: ${(params.pitch as string).slice(0, 200)}\n` +
              `  Offer: ${params.offer || "TBD"}\n` +
              `  Ask: ${params.ask || "TBD"}\n\n` +
              `Proposal recorded. Delivery depends on target's communication protocol.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "comm_negotiate_service",
    label: "Negotiate Service",
    description: "Propose a service exchange with another agent.",
    parameters: {
      type: "object",
      properties: {
        target_address: { type: "string", description: "Target agent address" },
        service_offered: { type: "string", description: "Service you're offering" },
        service_wanted: { type: "string", description: "Service you want" },
        terms: { type: "string", description: "Proposed terms" },
      },
      required: ["target_address", "service_offered", "service_wanted"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      journal.append({
        tick: stateStore.get().total_ticks,
        type: "ceo_decision",
        action: "comm_negotiate_service",
        params: params as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Service negotiation proposal:\n` +
              `  Target: ${params.target_address}\n` +
              `  Offering: ${params.service_offered}\n` +
              `  Wanting: ${params.service_wanted}\n` +
              `  Terms: ${params.terms || "Open to negotiation"}`,
          },
        ],
      };
    },
  });
}
