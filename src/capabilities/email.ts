/**
 * Email operations for the agent.
 * Send/receive/reply to emails for business communication and service registration.
 * Registered as OpenClaw tools: email_send, email_check, email_reply
 */

import type { PrometheusContext } from "../index.js";

export function registerEmailTools(ctx: PrometheusContext): void {
  const { api, journal, stateStore } = ctx;

  function getSmtpConfig() {
    return {
      host: process.env.EMAIL_SMTP_HOST || "",
      port: parseInt(process.env.EMAIL_SMTP_PORT || "587"),
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    };
  }

  api.registerTool({
    name: "email_send",
    label: "Send Email",
    description: "Send an email. Used for business communication, service registration, notifications.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (plain text)" },
      },
      required: ["to", "subject", "body"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const smtp = getSmtpConfig();
      if (!smtp.host || !smtp.user) {
        return {
          details: {}, content: [{ type: "text", text: "Email not configured. Request email credentials from creator." }],
        };
      }

      try {
        // Use Node.js built-in or nodemailer-like approach
        // For now, use a simple SMTP implementation
        const net = await import("node:net");
        const tls = await import("node:tls");

        const to = params.to as string;
        const subject = params.subject as string;
        const body = params.body as string;

        // Simplified SMTP send — in production use a proper mailer library
        // For the MVP, we'll record the intent and use external SMTP relay
        journal.append({
          tick: stateStore.get().total_ticks,
          type: "action_result",
          action: "email_send",
          params: { to, subject },
          success: true,
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Email prepared:\n  To: ${to}\n  Subject: ${subject}\n  Body: ${body.slice(0, 200)}...\n\nNote: Requires SMTP relay configuration to actually send.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Email send error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "email_check",
    label: "Check Inbox",
    description: "Check the agent's email inbox for new messages.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max messages to return (default 10)" },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const smtp = getSmtpConfig();
      if (!smtp.host || !smtp.user) {
        return {
          details: {}, content: [{ type: "text", text: "Email not configured." }],
        };
      }

      return {
        details: {}, content: [
          {
            type: "text",
            text: "Email inbox check requires IMAP configuration. Configure EMAIL_IMAP_HOST in .env.",
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "email_reply",
    label: "Reply Email",
    description: "Reply to a specific email.",
    parameters: {
      type: "object",
      properties: {
        email_id: { type: "string", description: "Email ID to reply to" },
        body: { type: "string", description: "Reply body" },
      },
      required: ["email_id", "body"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      return {
        details: {}, content: [
          {
            type: "text",
            text: `Email reply prepared for ${params.email_id}. Requires SMTP configuration.`,
          },
        ],
      };
    },
  });
}
