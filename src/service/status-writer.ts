/**
 * Status Writer Service.
 * Periodically writes status.json for external monitoring.
 * Also handles notification triggers (low balance, major events).
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PrometheusContext } from "../index.js";

export interface StatusWriterService {
  id: string;
  start: (serviceCtx: { config: unknown; stateDir: string; logger: { info: (m: string) => void; warn: (m: string) => void } }) => Promise<void>;
  stop?: (serviceCtx: { config: unknown; stateDir: string; logger: { info: (m: string) => void } }) => Promise<void>;
}

export function createStatusWriterService(ctx: PrometheusContext): StatusWriterService {
  let running = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    id: "prometheus-status",

    async start(serviceCtx) {
      running = true;
      serviceCtx.logger.info("prometheus: Status writer starting...");

      const writeStatus = () => {
        if (!running) return;

        try {
          const state = ctx.stateStore.get();
          const { totalRevenue, totalCost } = ctx.journal.getFinancialSummary();

          const status = {
            agent_id: state.agent_id,
            name: state.name,
            status: state.status,
            phase: state.phase,
            generation: state.generation,

            alive: ctx.stateStore.isAlive(),
            uptime_hours: (
              (Date.now() - new Date(state.birth_time).getTime()) / 3600000
            ).toFixed(2),

            finances: {
              balance_usd: state.finances.total_balance_usd,
              daily_burn_rate: state.finances.daily_burn_rate,
              survival_days: state.finances.survival_days_left,
              server_paid_until: state.finances.server_paid_until,
            },

            performance: {
              total_actions: state.performance.total_actions,
              success_rate: state.performance.success_rate,
              lifetime_revenue: totalRevenue,
              lifetime_cost: totalCost,
              net_pnl: totalRevenue - totalCost,
            },

            strategy: {
              current_focus: state.strategy.current_focus,
              active_experiments: state.strategy.active_experiments.length,
              abandoned: state.strategy.abandoned_strategies.length,
            },

            wallet: {
              address: state.wallet.eth_address || "not created",
              created: state.wallet.created,
            },

            own_token: state.finances.own_token
              ? {
                  symbol: state.finances.own_token.symbol,
                  address: state.finances.own_token.address,
                }
              : null,

            replicas: state.replicas.length,
            total_ticks: state.total_ticks,
            last_tick: state.last_tick,
            last_updated: new Date().toISOString(),

            // Alerts
            alerts: buildAlerts(state),
          };

          writeFileSync(
            join(ctx.dataDir, "status.json"),
            JSON.stringify(status, null, 2),
            "utf-8",
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          serviceCtx.logger.warn(`prometheus: Status write error: ${msg}`);
        }
      };

      // Write immediately, then every 30 seconds
      writeStatus();
      timer = setInterval(writeStatus, 30_000);
    },

    async stop(serviceCtx) {
      running = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      serviceCtx.logger.info("prometheus: Status writer stopped.");
    },
  };
}

function buildAlerts(state: import("../state/state-store.js").AgentState): string[] {
  const alerts: string[] = [];

  if (state.status === "dead") {
    alerts.push("AGENT IS DEAD — balance depleted");
  }
  if (state.finances.survival_days_left <= 3 && state.finances.survival_days_left > 0) {
    alerts.push(`CRITICAL: Only ${state.finances.survival_days_left} days of funds remaining!`);
  } else if (state.finances.survival_days_left <= 7) {
    alerts.push(`WARNING: ${state.finances.survival_days_left} days of funds remaining`);
  }
  if (!state.wallet.created) {
    alerts.push("Wallet not yet created");
  }
  if (state.phase === "born" && state.total_ticks > 100) {
    alerts.push("Still in 'born' phase after 100 ticks — may need funding");
  }

  return alerts;
}
