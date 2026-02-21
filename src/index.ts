/**
 * Prometheus - OpenClaw Plugin Entry Point
 *
 * Registers all capabilities, awareness modules, the CEO brain service,
 * and lifecycle hooks for the autonomous AI agent.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { prometheusConfigSchema, type PrometheusConfig } from "./config.js";

// Capabilities (registered as OpenClaw tools)
import { registerWalletTools } from "./capabilities/wallet.js";
import { registerDefiTools } from "./capabilities/defi.js";
import { registerTokenFactoryTools } from "./capabilities/token-factory.js";
import { registerContractDeployerTools } from "./capabilities/contract-deployer.js";
import { registerIdentityTools } from "./capabilities/identity-manager.js";
import { registerSocialMediaTools } from "./capabilities/social-media.js";
import { registerEmailTools } from "./capabilities/email.js";
import { registerGithubTools } from "./capabilities/github-ops.js";
import { registerCommunicatorTools } from "./capabilities/communicator.js";
import { registerWebServiceTools } from "./capabilities/web-service.js";
import { registerDbcGpuTools } from "./capabilities/dbc-gpu.js";
import { registerPitchDeckTools } from "./capabilities/pitch-deck.js";
import { registerSelfReplicatorTools } from "./capabilities/self-replicator.js";

// Awareness (registered as OpenClaw tools)
import { registerBalanceMonitorTools } from "./awareness/balance-monitor.js";
import { registerBudgetTrackerTools } from "./awareness/budget-tracker.js";
import { registerMarketScannerTools } from "./awareness/market-scanner.js";
import { registerWebResearcherTools } from "./awareness/web-researcher.js";

// Services
import { createCeoLoopService } from "./service/ceo-loop.js";
import { createStatusWriterService } from "./service/status-writer.js";

// State
import { StateStore } from "./state/state-store.js";
import { Journal } from "./state/journal.js";

// Brain
import { injectCeoContext } from "./brain/prompts.js";

/** Shared runtime context passed to all modules */
export interface PrometheusContext {
  config: PrometheusConfig;
  stateStore: StateStore;
  journal: Journal;
  api: OpenClawPluginApi;
  dataDir: string;
}

const plugin = {
  id: "prometheus",
  name: "Prometheus - Autonomous AI Agent",
  description:
    "Self-sustaining autonomous agent with MPC wallet, DeFi, token factory, and self-replication capabilities.",
  version: "0.1.0",
  configSchema: prometheusConfigSchema,

  async register(api: OpenClawPluginApi) {
    const config = prometheusConfigSchema.parse(api.pluginConfig);
    const dataDir = api.resolvePath("data");

    // Ensure data directory exists
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });

    // Initialize state layer
    const stateStore = new StateStore(dataDir);
    const journal = new Journal(dataDir);

    const ctx: PrometheusContext = { config, stateStore, journal, api, dataDir };

    api.logger.info("prometheus: registering capabilities...");

    // --- Register all capability tools ---
    registerWalletTools(ctx);
    registerDefiTools(ctx);
    registerTokenFactoryTools(ctx);
    registerContractDeployerTools(ctx);
    registerIdentityTools(ctx);
    registerSocialMediaTools(ctx);
    registerEmailTools(ctx);
    registerGithubTools(ctx);
    registerCommunicatorTools(ctx);
    registerWebServiceTools(ctx);
    registerDbcGpuTools(ctx);
    registerPitchDeckTools(ctx);
    registerSelfReplicatorTools(ctx);

    // --- Register awareness tools ---
    registerBalanceMonitorTools(ctx);
    registerBudgetTrackerTools(ctx);
    registerMarketScannerTools(ctx);
    registerWebResearcherTools(ctx);

    // --- Register lifecycle hooks ---
    api.on("before_agent_start", (event, _hookCtx) => injectCeoContext(event, ctx), { priority: 10 });

    // --- Register background services ---
    api.registerService(createCeoLoopService(ctx));
    api.registerService(createStatusWriterService(ctx));

    api.logger.info("prometheus: plugin registered successfully.");
  },
};

export default plugin;
