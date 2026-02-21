/**
 * CEO Loop Service — the autonomous heartbeat.
 * Registered as an OpenClaw background service.
 *
 * Loop:
 * 1. Perception update (balances, market)
 * 2. Survival check
 * 3. CEO tick (LLM decision)
 * 4. Execute decision
 * 5. Record result
 * 6. Periodic reflection
 * 7. Write status
 * 8. Dynamic sleep
 */

import type { PrometheusContext } from "../index.js";
import { CeoEngine } from "../brain/ceo.js";

export interface CeoLoopService {
  id: string;
  start: (serviceCtx: { config: unknown; stateDir: string; logger: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void } }) => Promise<void>;
  stop?: (serviceCtx: { config: unknown; stateDir: string; logger: { info: (m: string) => void } }) => Promise<void>;
}

export function createCeoLoopService(ctx: PrometheusContext): CeoLoopService {
  let running = false;
  let loopTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    id: "prometheus-ceo",

    async start(serviceCtx) {
      const logger = serviceCtx.logger;
      running = true;
      logger.info("prometheus: CEO loop starting...");

      const ceo = new CeoEngine(ctx);

      const loop = async () => {
        if (!running) return;

        const state = ctx.stateStore.get();

        // Check if agent is alive
        if (!ctx.stateStore.isAlive()) {
          logger.info("prometheus: Agent is stopped/dead. CEO loop halted.");
          return;
        }

        // Check for death condition
        if (
          state.finances.total_balance_usd <= 0 &&
          state.performance.total_actions > 10 &&
          state.phase !== "born"
        ) {
          logger.warn("prometheus: Agent balance is zero. Declaring death.");
          ctx.stateStore.update({ status: "dead" });
          ctx.journal.append({
            tick: state.total_ticks,
            type: "milestone",
            action: "death",
            reasoning: "Balance reached zero. No resources to continue.",
          });
          return;
        }

        // Survival mode check
        if (
          state.finances.survival_days_left <= 7 &&
          state.finances.survival_days_left > 0 &&
          state.status !== "survival_mode"
        ) {
          ctx.stateStore.update({ status: "survival_mode" });
          logger.warn(
            `prometheus: Entering survival mode. ${state.finances.survival_days_left} days left.`,
          );
        } else if (
          state.finances.survival_days_left > 7 &&
          state.status === "survival_mode"
        ) {
          ctx.stateStore.update({ status: "running" });
        }

        try {
          // Auto-advance phase
          ceo.autoAdvancePhase();

          // CEO tick
          const tickResult = await ceo.tick();

          if (tickResult.error) {
            logger.error(`prometheus: CEO tick error: ${tickResult.error}`);
          } else if (tickResult.decision) {
            logger.info(
              `prometheus: CEO decided: ${tickResult.decision.tool_name}`,
            );

            // Execute the tool via OpenClaw's tool system
            // The tool is already registered, so we can call it through the API
            // In the OpenClaw runtime, the agent would execute the tool call
            // Here we record that the decision was made — execution happens
            // through the regular OpenClaw tool pipeline

            ctx.stateStore.recordAction(true);
          } else {
            logger.info("prometheus: CEO thinking cycle (no action taken).");
          }

          // Periodic reflection
          await ceo.maybeReflect();
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error(`prometheus: CEO loop error: ${msg}`);
          ctx.journal.append({
            tick: state.total_ticks,
            type: "error",
            details: { error: msg, phase: "ceo_loop" },
          });
        }

        // Dynamic interval
        const nextInterval = ceo.getTickInterval();
        if (running) {
          loopTimer = setTimeout(loop, nextInterval);
        }
      };

      // Start the loop
      // Small delay to let all tools finish registering
      loopTimer = setTimeout(loop, 5000);
    },

    async stop(serviceCtx) {
      running = false;
      if (loopTimer) {
        clearTimeout(loopTimer);
        loopTimer = null;
      }
      serviceCtx.logger.info("prometheus: CEO loop stopped.");
    },
  };
}
