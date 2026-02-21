/**
 * Balance monitoring - tracks all token balances across chains.
 * Registered as OpenClaw tool: balance_check
 */

import type { PrometheusContext } from "../index.js";
import { createClients, getNativeBalance, getErc20Balance, BASE_TOKENS, type Address } from "../tools/web3.js";

export function registerBalanceMonitorTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  api.registerTool({
    name: "balance_check",
    label: "Check All Balances",
    description:
      "Comprehensive balance check across Base L2 and DBC chain. Returns native tokens, known ERC20s, and agent's own token if deployed. Updates internal state.",
    parameters: {
      type: "object",
      properties: {
        include_prices: {
          type: "boolean",
          description: "Whether to estimate USD values (slower, requires price feeds)",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet yet." }] };
      }

      const address = state.wallet.eth_address as Address;
      const clients = createClients(config.baseRpcUrl, config.dbcRpcUrl);
      const balances: Record<string, { amount: string; usd_estimate?: number }> = {};

      try {
        // Native balances
        const [ethBal, dbcBal] = await Promise.all([
          getNativeBalance(clients.base, address).catch(() => "0"),
          getNativeBalance(clients.dbc, address).catch(() => "0"),
        ]);
        balances["ETH"] = { amount: ethBal };
        balances["DBC"] = { amount: dbcBal };

        // Known ERC20s on Base
        for (const [symbol, tokenAddr] of Object.entries(BASE_TOKENS)) {
          try {
            const info = await getErc20Balance(clients.base, tokenAddr, address);
            balances[symbol] = { amount: info.balance };
          } catch {
            // skip tokens with 0 balance or errors
          }
        }

        // Agent's own token
        if (state.finances.own_token?.address) {
          try {
            const info = await getErc20Balance(
              clients.base,
              state.finances.own_token.address as Address,
              address,
            );
            balances[state.finances.own_token.symbol] = { amount: info.balance };
          } catch {
            // token may not be deployed yet
          }
        }

        // Update state tokens
        const tokenMap: Record<string, number> = {};
        for (const [symbol, data] of Object.entries(balances)) {
          tokenMap[symbol] = parseFloat(data.amount) || 0;
        }
        stateStore.updateFinances({ tokens: tokenMap });

        // Rough USD estimate (USDT/USDC = $1, ETH ~= price feed needed)
        const usdStables = (tokenMap["USDT"] || 0) + (tokenMap["USDC"] || 0) + (tokenMap["DAI"] || 0);
        // For now, approximate total - a real price feed would be needed
        stateStore.updateFinances({ total_balance_usd: usdStables });

        journal.append({
          tick: state.total_ticks,
          type: "balance_update",
          details: { balances: tokenMap, total_usd_estimate: usdStables },
        });

        const lines = Object.entries(balances)
          .filter(([_, d]) => parseFloat(d.amount) > 0)
          .map(([sym, d]) => `  ${sym}: ${d.amount}`)
          .join("\n");

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Wallet: ${address}\n\nBalances:\n${lines || "  (all zero)"}\n\nEstimated stablecoin value: $${usdStables.toFixed(2)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Balance check error: ${msg}` }] };
      }
    },
  });
}
