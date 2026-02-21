/**
 * Identity and credential management.
 * Agent can request resources from creator and securely store credentials.
 * Registered as OpenClaw tools: identity_request_resources, identity_store_credentials,
 *   identity_list_credentials, identity_change_password
 */

import type { PrometheusContext } from "../index.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

export function registerIdentityTools(ctx: PrometheusContext): void {
  const { api, stateStore, journal, dataDir } = ctx;
  const credDir = join(dataDir, "credentials");
  mkdirSync(credDir, { recursive: true });

  // Simple encryption using agent's PKP public key as seed
  function getEncryptionKey(): Buffer {
    const state = stateStore.get();
    const seed = state.wallet.pkp_public_key || state.agent_id;
    return createHash("sha256").update(seed).digest();
  }

  function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  api.registerTool({
    name: "identity_request_resources",
    label: "Request Resources",
    description:
      "Generate a list of resources the agent wants from the creator (angel investor). " +
      "This includes email accounts, social media, GitHub, domains, API keys. " +
      "The creator decides what to provide — this is part of the 'birth ceremony'.",
    parameters: {
      type: "object",
      properties: {
        needs: {
          type: "string",
          description:
            "JSON array of resource requests, each with 'type' (email/twitter/github/domain/api_key), 'purpose', and 'priority' (high/medium/low)",
        },
      },
      required: ["needs"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const needs = JSON.parse(params.needs as string) as Array<{
        type: string;
        purpose: string;
        priority: string;
      }>;

      stateStore.updateIdentity({
        requested_resources: needs.map((n) => `${n.type}: ${n.purpose} (${n.priority})`),
      });

      journal.append({
        tick: stateStore.get().total_ticks,
        type: "resource_request",
        details: { needs },
      });

      const formatted = needs
        .map((n, i) => `  ${i + 1}. [${n.priority.toUpperCase()}] ${n.type} - ${n.purpose}`)
        .join("\n");

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Resource Request for Creator:\n\n${formatted}\n\n` +
              `Creator: Please provide these resources. Once handed over, the agent will manage them independently.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "identity_store_credentials",
    label: "Store Credentials",
    description:
      "Securely store credentials received from the creator. Encrypted with agent-controlled key.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name (e.g. 'twitter', 'github', 'email')" },
        username: { type: "string", description: "Username/login" },
        password: { type: "string", description: "Password or API key" },
        extra: { type: "string", description: "Additional credentials (JSON)" },
      },
      required: ["service", "username", "password"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const service = params.service as string;
      const username = params.username as string;
      const password = params.password as string;
      const extra = params.extra as string | undefined;

      const credData = {
        service,
        username,
        password: encrypt(password),
        extra: extra ? encrypt(extra) : undefined,
        stored_at: new Date().toISOString(),
      };

      writeFileSync(
        join(credDir, `${service}.json`),
        JSON.stringify(credData, null, 2),
        "utf-8",
      );

      const state = stateStore.get();
      const creds = { ...state.identity.credentials };
      creds[service] = { service, username, stored: true };
      stateStore.updateIdentity({
        credentials: creds,
        received_resources: [...state.identity.received_resources, service],
      });

      journal.append({
        tick: state.total_ticks,
        type: "resource_received",
        details: { service, username },
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Credentials stored securely for ${service} (user: ${username}). Encrypted with agent-controlled key.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "identity_list_credentials",
    label: "List Credentials",
    description: "List all stored credentials (shows services and usernames, not passwords).",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const state = stateStore.get();
      const creds = state.identity.credentials;
      if (Object.keys(creds).length === 0) {
        return { details: {}, content: [{ type: "text", text: "No credentials stored yet." }] };
      }
      const lines = Object.values(creds)
        .map((c) => `  ${c.service}: ${c.username} (${c.stored ? "stored" : "pending"})`)
        .join("\n");
      return {
        details: {}, content: [{ type: "text", text: `Stored Credentials:\n${lines}` }],
      };
    },
  });

  api.registerTool({
    name: "identity_get_credential",
    label: "Get Credential",
    description: "Retrieve a stored credential (decrypted). Used internally by other capabilities.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name" },
      },
      required: ["service"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const service = params.service as string;
      const credPath = join(credDir, `${service}.json`);

      if (!existsSync(credPath)) {
        return { details: {}, content: [{ type: "text", text: `No credentials found for ${service}.` }] };
      }

      try {
        const raw = JSON.parse(readFileSync(credPath, "utf-8"));
        return {
          details: {}, content: [
            {
              type: "text",
              text: JSON.stringify({
                service: raw.service,
                username: raw.username,
                password: decrypt(raw.password),
                extra: raw.extra ? decrypt(raw.extra) : undefined,
              }),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Error retrieving credential: ${msg}` }] };
      }
    },
  });
}
