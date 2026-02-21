/**
 * DeFi operations capability.
 * Swap, liquidity, flash loans, arbitrage scanning on Base L2.
 * Registered as OpenClaw tools: defi_swap, defi_add_liquidity, defi_remove_liquidity,
 *   defi_flash_loan, defi_check_arbitrage, defi_pool_stats
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";
import { createClients, type Address, parseUnits, formatUnits } from "../tools/web3.js";

// Uniswap V3 Router on Base
const UNISWAP_V3_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
// Aerodrome Router on Base
const AERODROME_ROUTER = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as Address;

export function registerDefiTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  api.registerTool({
    name: "defi_swap",
    label: "DEX Swap",
    description:
      "Swap tokens on a DEX (Uniswap V3 or Aerodrome on Base). Builds the swap transaction for PKP signing.",
    parameters: {
      type: "object",
      properties: {
        token_in: { type: "string", description: "Address of token to sell" },
        token_out: { type: "string", description: "Address of token to buy" },
        amount_in: { type: "string", description: "Amount to sell (human-readable)" },
        dex: { type: "string", enum: ["uniswap", "aerodrome"], description: "Which DEX to use" },
        slippage_bps: { type: "number", description: "Slippage tolerance in basis points (default 50 = 0.5%)" },
      },
      required: ["token_in", "token_out", "amount_in"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet created yet." }] };
      }

      const tokenIn = params.token_in as string;
      const tokenOut = params.token_out as string;
      const amountIn = params.amount_in as string;
      const dex = (params.dex as string) || "uniswap";
      const slippageBps = (params.slippage_bps as number) || 50;

      try {
        // Get quote first via 0x API or on-chain
        const router = dex === "aerodrome" ? AERODROME_ROUTER : UNISWAP_V3_ROUTER;

        // Build swap calldata
        // In production, this would encode the exact swap function call
        // For now, we prepare the parameters for the CEO to review
        const swapInfo = {
          action: "defi_swap",
          dex,
          router: router,
          token_in: tokenIn,
          token_out: tokenOut,
          amount_in: amountIn,
          slippage_bps: slippageBps,
          wallet: state.wallet.eth_address,
          status: "prepared",
          note: "Transaction prepared. Use wallet_sign to execute.",
        };

        journal.append({
          tick: state.total_ticks,
          type: "ceo_decision",
          action: "defi_swap",
          params: { tokenIn, tokenOut, amountIn, dex },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Swap prepared:\n` +
                `  DEX: ${dex}\n` +
                `  Sell: ${amountIn} of ${tokenIn}\n` +
                `  Buy: ${tokenOut}\n` +
                `  Slippage: ${slippageBps / 100}%\n` +
                `  Router: ${router}\n\n` +
                `Ready to execute via PKP signing.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        journal.append({
          tick: state.total_ticks,
          type: "error",
          action: "defi_swap",
          success: false,
          details: { error: msg },
        });
        return { details: {}, content: [{ type: "text", text: `Swap failed: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "defi_add_liquidity",
    label: "Add Liquidity",
    description: "Add liquidity to a DEX pool on Base. Requires two tokens and amounts.",
    parameters: {
      type: "object",
      properties: {
        token_a: { type: "string", description: "First token address" },
        token_b: { type: "string", description: "Second token address" },
        amount_a: { type: "string", description: "Amount of first token" },
        amount_b: { type: "string", description: "Amount of second token" },
        dex: { type: "string", enum: ["uniswap", "aerodrome"] },
      },
      required: ["token_a", "token_b", "amount_a", "amount_b"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet created yet." }] };
      }

      const info = {
        action: "add_liquidity",
        dex: params.dex || "uniswap",
        token_a: params.token_a,
        token_b: params.token_b,
        amount_a: params.amount_a,
        amount_b: params.amount_b,
      };

      journal.append({
        tick: state.total_ticks,
        type: "ceo_decision",
        action: "defi_add_liquidity",
        params: info as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Liquidity provision prepared:\n` +
              `  Token A: ${params.amount_a} of ${params.token_a}\n` +
              `  Token B: ${params.amount_b} of ${params.token_b}\n` +
              `  DEX: ${params.dex || "uniswap"}\n\n` +
              `Ready to execute via PKP signing.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "defi_remove_liquidity",
    label: "Remove Liquidity",
    description: "Remove liquidity from a DEX pool.",
    parameters: {
      type: "object",
      properties: {
        pool_address: { type: "string", description: "Pool/LP token address" },
        percentage: { type: "number", description: "Percentage to remove (1-100)" },
      },
      required: ["pool_address", "percentage"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      journal.append({
        tick: stateStore.get().total_ticks,
        type: "ceo_decision",
        action: "defi_remove_liquidity",
        params: params as any,
      });
      return {
        details: {}, content: [
          {
            type: "text",
            text: `Liquidity removal prepared: ${params.percentage}% from pool ${params.pool_address}`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "defi_check_arbitrage",
    label: "Check Arbitrage",
    description:
      "Scan for arbitrage opportunities between DEXes on Base. Compares prices across Uniswap V3 and Aerodrome.",
    parameters: {
      type: "object",
      properties: {
        token_pairs: {
          type: "string",
          description: "Comma-separated token symbols to check (e.g. 'WETH/USDC,WETH/USDT')",
        },
        min_profit_bps: {
          type: "number",
          description: "Minimum profit in basis points to report (default 10 = 0.1%)",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const minProfitBps = (params.min_profit_bps as number) || 10;

      try {
        // Check DexScreener for Base pairs to find price discrepancies
        const resp = await httpRequest<any>(
          "https://api.dexscreener.com/latest/dex/pairs/base",
          { timeoutMs: 10_000 },
        );

        if (!resp.ok || !resp.data?.pairs) {
          return { details: {}, content: [{ type: "text", text: "Unable to fetch market data for arbitrage scan." }] };
        }

        // Group pairs by token pair to find price differences
        const pairMap: Record<string, Array<{ dex: string; price: number; liquidity: number }>> = {};
        for (const pair of resp.data.pairs.slice(0, 100)) {
          const key = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
          if (!pairMap[key]) pairMap[key] = [];
          pairMap[key].push({
            dex: pair.dexId || "unknown",
            price: parseFloat(pair.priceUsd) || 0,
            liquidity: pair.liquidity?.usd || 0,
          });
        }

        // Find opportunities
        const opportunities: string[] = [];
        for (const [pair, entries] of Object.entries(pairMap)) {
          if (entries.length < 2) continue;
          entries.sort((a, b) => a.price - b.price);
          const low = entries[0];
          const high = entries[entries.length - 1];
          if (low.price <= 0) continue;
          const spreadBps = ((high.price - low.price) / low.price) * 10000;
          if (spreadBps >= minProfitBps && low.liquidity > 1000 && high.liquidity > 1000) {
            opportunities.push(
              `  ${pair}: Buy@${low.dex}($${low.price.toFixed(6)}) → Sell@${high.dex}($${high.price.toFixed(6)}) | Spread: ${spreadBps.toFixed(0)}bps | Liq: $${Math.min(low.liquidity, high.liquidity).toFixed(0)}`,
            );
          }
        }

        return {
          details: {}, content: [
            {
              type: "text",
              text: opportunities.length > 0
                ? `Arbitrage Opportunities (>${minProfitBps}bps):\n${opportunities.join("\n")}`
                : `No arbitrage opportunities above ${minProfitBps}bps found.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Arbitrage scan error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "defi_pool_stats",
    label: "Pool Stats",
    description: "Get statistics for a specific DEX pool (APR, TVL, volume).",
    parameters: {
      type: "object",
      properties: {
        pool_address: { type: "string", description: "Pool address on Base" },
      },
      required: ["pool_address"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const poolAddr = params.pool_address as string;
      try {
        const resp = await httpRequest<any>(
          `https://api.dexscreener.com/latest/dex/pairs/base/${poolAddr}`,
          { timeoutMs: 10_000 },
        );
        if (!resp.ok || !resp.data?.pair) {
          return { details: {}, content: [{ type: "text", text: `Pool ${poolAddr} not found.` }] };
        }
        const p = resp.data.pair;
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Pool: ${p.baseToken?.symbol}/${p.quoteToken?.symbol}\n` +
                `Price: $${p.priceUsd}\n` +
                `Liquidity: $${p.liquidity?.usd ?? "?"}\n` +
                `Volume 24h: $${p.volume?.h24 ?? "?"}\n` +
                `Price Change 24h: ${p.priceChange?.h24 ?? "?"}%\n` +
                `DEX: ${p.dexId}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Pool stats error: ${msg}` }] };
      }
    },
  });
}
