/**
 * DBC GPU management - the agent's "physical body".
 * Rent GPU containers on DBC chain, deploy workloads, manage lifecycle.
 * Registered as OpenClaw tools: dbc_rent_gpu, dbc_gpu_status, dbc_renew_gpu,
 *   dbc_deploy_container, dbc_estimate_cost
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerDbcGpuTools(ctx: PrometheusContext): void {
  const { api, config, journal, stateStore } = ctx;

  api.registerTool({
    name: "dbc_rent_gpu",
    label: "Rent DBC GPU",
    description:
      "Rent a GPU container on the DBC chain. This is the agent's 'physical body' — needed for independent operation. Costs DBC tokens.",
    parameters: {
      type: "object",
      properties: {
        gpu_type: {
          type: "string",
          description: "GPU type (e.g. 'rtx3080', 'rtx4090', 'a100')",
        },
        duration_days: { type: "number", description: "Rental duration in days" },
        cpu_cores: { type: "number", description: "Number of CPU cores (default 4)" },
        ram_gb: { type: "number", description: "RAM in GB (default 16)" },
        storage_gb: { type: "number", description: "Storage in GB (default 50)" },
      },
      required: ["gpu_type", "duration_days"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const gpuType = params.gpu_type as string;
      const durationDays = params.duration_days as number;
      const cpuCores = (params.cpu_cores as number) || 4;
      const ramGb = (params.ram_gb as number) || 16;
      const storageGb = (params.storage_gb as number) || 50;

      try {
        // Call DBC GPU Cloud Service API
        const resp = await httpRequest<any>(`${config.dbcGpuApiUrl}/gpu/rent`, {
          method: "POST",
          body: {
            gpu_type: gpuType,
            duration_days: durationDays,
            cpu_cores: cpuCores,
            ram_gb: ramGb,
            storage_gb: storageGb,
            wallet_address: stateStore.get().wallet.eth_address,
          },
          timeoutMs: 30_000,
        });

        journal.append({
          tick: stateStore.get().total_ticks,
          type: "ceo_decision",
          action: "dbc_rent_gpu",
          params: { gpuType, durationDays, cpuCores, ramGb, storageGb },
          success: resp.ok,
          cost_usd: resp.data?.cost_usd,
          details: resp.data,
        });

        if (resp.ok) {
          const paidUntil = new Date(
            Date.now() + durationDays * 24 * 60 * 60 * 1000,
          ).toISOString();
          stateStore.updateFinances({ server_paid_until: paidUntil });

          return {
            details: {}, content: [
              {
                type: "text",
                text: `GPU rented successfully!\n` +
                  `  Type: ${gpuType}\n` +
                  `  Duration: ${durationDays} days\n` +
                  `  Specs: ${cpuCores} CPU, ${ramGb}GB RAM, ${storageGb}GB Storage\n` +
                  `  Container ID: ${resp.data?.container_id || "pending"}\n` +
                  `  Paid until: ${paidUntil}`,
              },
            ],
          };
        }

        return {
          details: {}, content: [
            {
              type: "text",
              text: `GPU rental failed: ${JSON.stringify(resp.data)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `GPU rental error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "dbc_gpu_status",
    label: "GPU Status",
    description: "Check the status of the agent's current GPU container.",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const state = stateStore.get();
      const paidUntil = state.finances.server_paid_until;

      if (!paidUntil) {
        return {
          details: {}, content: [
            {
              type: "text",
              text: "No GPU container rented. Agent is running on creator's hardware (free but dependent).",
            },
          ],
        };
      }

      const daysLeft = Math.max(
        0,
        (new Date(paidUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );

      try {
        const resp = await httpRequest<any>(`${config.dbcGpuApiUrl}/gpu/status`, {
          method: "POST",
          body: { wallet_address: state.wallet.eth_address },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `GPU Container Status:\n` +
                `  Paid until: ${paidUntil}\n` +
                `  Days remaining: ${daysLeft.toFixed(1)}\n` +
                `  Status: ${resp.ok ? (resp.data?.status || "active") : "unknown"}\n` +
                `  ${daysLeft < 3 ? "⚠️ RENEWAL NEEDED SOON!" : ""}`,
            },
          ],
        };
      } catch {
        return {
          details: {}, content: [
            {
              type: "text",
              text: `GPU Status: Paid until ${paidUntil} (${daysLeft.toFixed(1)} days left). API unreachable.`,
            },
          ],
        };
      }
    },
  });

  api.registerTool({
    name: "dbc_renew_gpu",
    label: "Renew GPU",
    description: "Renew the agent's GPU container rental.",
    parameters: {
      type: "object",
      properties: {
        duration_days: { type: "number", description: "Additional days to rent" },
      },
      required: ["duration_days"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const durationDays = params.duration_days as number;
      const state = stateStore.get();

      try {
        const resp = await httpRequest<any>(`${config.dbcGpuApiUrl}/gpu/renew`, {
          method: "POST",
          body: {
            wallet_address: state.wallet.eth_address,
            duration_days: durationDays,
          },
        });

        if (resp.ok) {
          const currentEnd = state.finances.server_paid_until
            ? new Date(state.finances.server_paid_until)
            : new Date();
          const newEnd = new Date(
            currentEnd.getTime() + durationDays * 24 * 60 * 60 * 1000,
          );
          stateStore.updateFinances({ server_paid_until: newEnd.toISOString() });
        }

        journal.append({
          tick: state.total_ticks,
          type: "action_result",
          action: "dbc_renew_gpu",
          success: resp.ok,
          cost_usd: resp.data?.cost_usd,
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: resp.ok
                ? `GPU renewed for ${durationDays} days.`
                : `Renewal failed: ${JSON.stringify(resp.data)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Renewal error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "dbc_deploy_container",
    label: "Deploy Container",
    description: "Deploy a Docker container on the agent's GPU instance.",
    parameters: {
      type: "object",
      properties: {
        docker_image: { type: "string", description: "Docker image to deploy" },
        env_vars: { type: "string", description: "JSON-encoded environment variables" },
        ports: { type: "string", description: "Comma-separated port mappings (e.g. '8080:8080,443:443')" },
      },
      required: ["docker_image"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      journal.append({
        tick: stateStore.get().total_ticks,
        type: "ceo_decision",
        action: "dbc_deploy_container",
        params: params as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Container deployment prepared:\n` +
              `  Image: ${params.docker_image}\n` +
              `  Ports: ${params.ports || "default"}\n\n` +
              `Requires active GPU rental to execute.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "dbc_estimate_cost",
    label: "Estimate GPU Cost",
    description: "Estimate the cost of renting a GPU on DBC chain.",
    parameters: {
      type: "object",
      properties: {
        gpu_type: { type: "string", description: "GPU type" },
        duration_days: { type: "number", description: "Duration in days" },
      },
      required: ["gpu_type", "duration_days"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const gpuType = params.gpu_type as string;
      const days = params.duration_days as number;

      // Rough estimates based on DBC pricing
      const pricePerDay: Record<string, number> = {
        rtx3080: 0.5,
        rtx3090: 0.8,
        rtx4090: 1.5,
        a100: 3.0,
        h100: 8.0,
      };

      const dailyCost = pricePerDay[gpuType.toLowerCase()] || 1.0;
      const totalCostUsd = dailyCost * days;

      return {
        details: {}, content: [
          {
            type: "text",
            text: `GPU Cost Estimate:\n` +
              `  Type: ${gpuType}\n` +
              `  Duration: ${days} days\n` +
              `  Daily cost: ~$${dailyCost.toFixed(2)}/day (in DBC tokens)\n` +
              `  Total: ~$${totalCostUsd.toFixed(2)}\n\n` +
              `Note: Actual prices depend on DBC market rate and availability.`,
          },
        ],
      };
    },
  });
}
