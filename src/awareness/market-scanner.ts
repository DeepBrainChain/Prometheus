/**
 * Market scanning and opportunity detection.
 * DEX price spreads, gas prices, new pools, trending tokens.
 * Registered as OpenClaw tools: market_scan, gas_check
 */

import type { PrometheusContext } from "../index.js";
import { createClients, getGasPrice } from "../tools/web3.js";
import { httpRequest } from "../tools/http.js";

export function registerMarketScannerTools(ctx: PrometheusContext): void {
  const { api, config } = ctx;

  api.registerTool({
    name: "market_scan",
    label: "Scan Market",
    description:
      "Scan DeFi markets for opportunities: DEX price spreads, new pools, trending tokens on Base L2. Returns actionable opportunities.",
    parameters: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          enum: ["arbitrage", "new_pools", "trending", "all"],
          description: "What to scan for. Default: all",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const focus = (params.focus as string) || "all";
      const results: string[] = [];

      try {
        // Scan DexScreener API for Base chain opportunities
        if (focus === "all" || focus === "trending") {
          try {
            const resp = await httpRequest<any>(
              "https://api.dexscreener.com/latest/dex/tokens/trending?chainId=base",
              { timeoutMs: 10_000 },
            );
            if (resp.ok && Array.isArray(resp.data)) {
              results.push("--- Trending on Base ---");
              for (const pair of resp.data.slice(0, 10)) {
                results.push(
                  `  ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}: $${pair.priceUsd} | 24h: ${pair.priceChange?.h24 ?? "?"}% | Vol: $${pair.volume?.h24 ?? "?"}`,
                );
              }
            }
          } catch {
            results.push("--- Trending: Unable to fetch ---");
          }
        }

        if (focus === "all" || focus === "new_pools") {
          try {
            const resp = await httpRequest<any>(
              "https://api.dexscreener.com/latest/dex/pairs/base?sort=createdAt&order=desc",
              { timeoutMs: 10_000 },
            );
            if (resp.ok && resp.data?.pairs) {
              results.push("\n--- New Pools on Base ---");
              for (const pair of resp.data.pairs.slice(0, 10)) {
                results.push(
                  `  ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol} | Liq: $${pair.liquidity?.usd ?? "?"} | Age: ${pair.pairCreatedAt ? timeSince(pair.pairCreatedAt) : "?"}`,
                );
              }
            }
          } catch {
            results.push("--- New Pools: Unable to fetch ---");
          }
        }

        if (focus === "all" || focus === "arbitrage") {
          results.push("\n--- Arbitrage Opportunities ---");
          results.push(
            "  (Requires checking multiple DEX prices for same pair - use defi_check_arbitrage for detailed scan)",
          );
        }

        return {
          details: {}, content: [
            {
              type: "text",
              text: results.length > 0 ? results.join("\n") : "No market data available right now.",
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Market scan error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "gas_check",
    label: "Check Gas Prices",
    description: "Check current gas prices on Base L2 and DBC chain.",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      try {
        const clients = createClients(config.baseRpcUrl, config.dbcRpcUrl);
        const [baseGas, dbcGas] = await Promise.all([
          getGasPrice(clients.base).catch(() => "unavailable"),
          getGasPrice(clients.dbc).catch(() => "unavailable"),
        ]);
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Gas Prices:\n  Base L2: ${baseGas} Gwei\n  DBC Chain: ${dbcGas} Gwei`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Gas check error: ${msg}` }] };
      }
    },
  });
}

function timeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
