/**
 * Web service deployment and management.
 * Agent can deploy API services to generate revenue.
 * Registered as OpenClaw tools: webservice_deploy, webservice_status, webservice_list
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerWebServiceTools(ctx: PrometheusContext): void {
  const { api, journal, stateStore } = ctx;

  api.registerTool({
    name: "webservice_deploy",
    label: "Deploy Web Service",
    description:
      "Deploy a web API service to generate revenue. Can deploy to DBC GPU container or Akash. " +
      "Examples: AI text processing API, data aggregation API, on-chain data query API.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Service name" },
        description: { type: "string", description: "What the service does" },
        docker_image: { type: "string", description: "Docker image to deploy" },
        port: { type: "number", description: "Service port (default 8080)" },
        env_vars: { type: "string", description: "JSON-encoded environment variables" },
        platform: {
          type: "string",
          enum: ["dbc", "akash"],
          description: "Deployment platform",
        },
      },
      required: ["name", "description", "docker_image"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const name = params.name as string;
      const description = params.description as string;
      const dockerImage = params.docker_image as string;
      const port = (params.port as number) || 8080;
      const platform = (params.platform as string) || "dbc";

      journal.append({
        tick: stateStore.get().total_ticks,
        type: "ceo_decision",
        action: "webservice_deploy",
        params: { name, description, dockerImage, port, platform },
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Web service deployment prepared:\n` +
              `  Name: ${name}\n` +
              `  Description: ${description}\n` +
              `  Image: ${dockerImage}\n` +
              `  Port: ${port}\n` +
              `  Platform: ${platform}\n\n` +
              `Use dbc_deploy_container or akash deployment to execute.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "webservice_status",
    label: "Service Status",
    description: "Check the status of a deployed web service.",
    parameters: {
      type: "object",
      properties: {
        service_url: { type: "string", description: "Service health check URL" },
      },
      required: ["service_url"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const url = params.service_url as string;
      try {
        const resp = await httpRequest(url, { timeoutMs: 10_000 });
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Service ${url}: ${resp.ok ? "HEALTHY" : "UNHEALTHY"} (HTTP ${resp.status})`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Service ${url}: DOWN (${msg})` }] };
      }
    },
  });

  api.registerTool({
    name: "webservice_list",
    label: "List Services",
    description: "List all deployed web services and their status.",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      // Read from journal for deployed services
      const deployEntries = journal.readByType("ceo_decision", 50);
      const services = deployEntries
        .filter((e) => e.action === "webservice_deploy")
        .map((e) => `  ${e.params?.name || "?"}: ${e.params?.platform || "?"} (${e.time})`)
        .join("\n");

      return {
        details: {}, content: [
          {
            type: "text",
            text: services ? `Deployed Services:\n${services}` : "No services deployed yet.",
          },
        ],
      };
    },
  });
}
