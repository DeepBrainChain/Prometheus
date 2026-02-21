/**
 * Budget tracking and survival countdown.
 * Monitors income/expenses, calculates burn rate, triggers survival modes.
 * Registered as OpenClaw tool: budget_report
 */

import type { PrometheusContext } from "../index.js";

export function registerBudgetTrackerTools(ctx: PrometheusContext): void {
  const { api, stateStore, journal } = ctx;

  api.registerTool({
    name: "budget_report",
    label: "Budget Report",
    description:
      "Generate a financial report: income/expenses, daily P&L, burn rate, survival countdown. Essential for CEO decision-making.",
    parameters: {
      type: "object",
      properties: {
        period_hours: {
          type: "number",
          description: "Look-back period in hours (default 24)",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const periodHours = (params.period_hours as number) || 24;
      const state = stateStore.get();
      const recentEntries = journal.readLastHours(periodHours);

      // Calculate income/expenses from journal
      let periodRevenue = 0;
      let periodCost = 0;
      const actionCounts: Record<string, number> = {};

      for (const entry of recentEntries) {
        if (entry.revenue_usd) periodRevenue += entry.revenue_usd;
        if (entry.cost_usd) periodCost += entry.cost_usd;
        if (entry.action) {
          actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
        }
      }

      const periodPnl = periodRevenue - periodCost;
      const { totalRevenue, totalCost } = journal.getFinancialSummary();
      const lifetimePnl = totalRevenue - totalCost;

      // Calculate burn rate (cost per day)
      const ageBirthMs = Date.now() - new Date(state.birth_time).getTime();
      const ageDays = Math.max(ageBirthMs / (24 * 60 * 60 * 1000), 0.01);
      const dailyBurnRate = totalCost / ageDays;
      const dailyRevenue = totalRevenue / ageDays;
      const netDailyBurn = dailyBurnRate - dailyRevenue;

      // Survival calculation
      const currentBalance = state.finances.total_balance_usd;
      const survivalDays = netDailyBurn > 0 ? currentBalance / netDailyBurn : Infinity;

      // Determine survival mode
      let survivalMode: string;
      if (survivalDays <= 3) survivalMode = "CRITICAL - Immediate action needed!";
      else if (survivalDays <= 7) survivalMode = "WARNING - Enter conservative mode";
      else if (survivalDays <= 14) survivalMode = "CAUTION - Monitor closely";
      else survivalMode = "STABLE";

      // Update state
      stateStore.updateFinances({
        daily_burn_rate: dailyBurnRate,
        survival_days_left: survivalDays === Infinity ? 9999 : Math.floor(survivalDays),
      });

      // Top actions
      const topActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([a, c]) => `  ${a}: ${c}x`)
        .join("\n");

      const report = [
        `=== Budget Report (last ${periodHours}h) ===`,
        ``,
        `Current Balance: $${currentBalance.toFixed(2)} USD`,
        ``,
        `--- Period (${periodHours}h) ---`,
        `Revenue: $${periodRevenue.toFixed(2)}`,
        `Cost:    $${periodCost.toFixed(2)}`,
        `P&L:     $${periodPnl.toFixed(2)}`,
        ``,
        `--- Lifetime ---`,
        `Total Revenue: $${totalRevenue.toFixed(2)}`,
        `Total Cost:    $${totalCost.toFixed(2)}`,
        `Lifetime P&L:  $${lifetimePnl.toFixed(2)}`,
        `Age: ${ageDays.toFixed(1)} days`,
        ``,
        `--- Burn Rate ---`,
        `Daily Cost:    $${dailyBurnRate.toFixed(2)}/day`,
        `Daily Revenue: $${dailyRevenue.toFixed(2)}/day`,
        `Net Burn:      $${netDailyBurn.toFixed(2)}/day`,
        ``,
        `--- Survival ---`,
        `Days Left: ${survivalDays === Infinity ? "∞" : survivalDays.toFixed(1)}`,
        `Status: ${survivalMode}`,
        ``,
        `--- Top Actions ---`,
        topActions || "  (none)",
        ``,
        `Total Actions: ${state.performance.total_actions}`,
        `Success Rate:  ${(state.performance.success_rate * 100).toFixed(1)}%`,
      ].join("\n");

      return { details: {}, content: [{ type: "text", text: report }] };
    },
  });
}
