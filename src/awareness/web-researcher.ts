/**
 * Web research capability for the agent.
 * Searches the web, monitors crypto news, discovers other AI agents.
 * Registered as OpenClaw tools: web_search, web_fetch
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerWebResearcherTools(ctx: PrometheusContext): void {
  const { api } = ctx;

  api.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web for information. Useful for finding crypto opportunities, monitoring news, discovering other AI agents, learning new strategies.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: { type: "number", description: "Number of results (default 5, max 10)" },
      },
      required: ["query"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const query = params.query as string;
      const numResults = Math.min((params.num_results as number) || 5, 10);

      try {
        // Use DuckDuckGo instant answer API (no API key required)
        const encoded = encodeURIComponent(query);
        const resp = await httpRequest<any>(
          `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1`,
          { timeoutMs: 10_000 },
        );

        if (!resp.ok) {
          return { details: {}, content: [{ type: "text", text: `Search failed: HTTP ${resp.status}` }] };
        }

        const data = resp.data;
        const results: string[] = [`Search: "${query}"\n`];

        // Abstract (main answer)
        if (data.Abstract) {
          results.push(`Summary: ${data.Abstract}`);
          if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
          results.push("");
        }

        // Related topics
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
          results.push("Related:");
          for (const topic of data.RelatedTopics.slice(0, numResults)) {
            if (topic.Text) {
              results.push(`  - ${topic.Text}`);
              if (topic.FirstURL) results.push(`    URL: ${topic.FirstURL}`);
            }
          }
        }

        // Infobox
        if (data.Infobox?.content) {
          results.push("\nInfo:");
          for (const item of data.Infobox.content.slice(0, 5)) {
            results.push(`  ${item.label}: ${item.value}`);
          }
        }

        return {
          details: {}, content: [
            {
              type: "text",
              text: results.length > 1 ? results.join("\n") : "No results found. Try a different query.",
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Search error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "web_fetch",
    label: "Fetch Web Page",
    description:
      "Fetch and extract text content from a web page URL. Useful for reading documentation, APIs, articles.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch" },
        max_length: { type: "number", description: "Max characters to return (default 5000)" },
      },
      required: ["url"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const url = params.url as string;
      const maxLength = (params.max_length as number) || 5000;

      try {
        const resp = await httpRequest<string>(url, {
          timeoutMs: 15_000,
          headers: {
            "User-Agent": "Prometheus-Agent/0.1",
            Accept: "text/html,application/json,text/plain",
          },
        });

        if (!resp.ok) {
          return { details: {}, content: [{ type: "text", text: `Fetch failed: HTTP ${resp.status}` }] };
        }

        let text = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data, null, 2);

        // Basic HTML stripping
        text = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();

        if (text.length > maxLength) {
          text = text.slice(0, maxLength) + "\n...(truncated)";
        }

        return {
          details: {}, content: [{ type: "text", text: `Content from ${url}:\n\n${text}` }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Fetch error: ${msg}` }] };
      }
    },
  });
}
