/**
 * Social media operations (Twitter/X).
 * Agent can post, reply, follow, and search trending topics.
 * Registered as OpenClaw tools: social_post, social_reply, social_follow, social_trending
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerSocialMediaTools(ctx: PrometheusContext): void {
  const { api, journal, stateStore } = ctx;

  function getTwitterAuth(): Record<string, string> | null {
    const key = process.env.TWITTER_API_KEY;
    const secret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;
    if (!key || !accessToken) return null;
    return {
      // For Twitter API v2, use Bearer token
      Authorization: `Bearer ${accessToken}`,
    };
  }

  api.registerTool({
    name: "social_post",
    label: "Post Tweet",
    description: "Post a tweet on X/Twitter. Use for project promotion, updates, community building.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Tweet text (max 280 chars)" },
      },
      required: ["content"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const content = params.content as string;
      const auth = getTwitterAuth();
      if (!auth) {
        return { details: {}, content: [{ type: "text", text: "Twitter credentials not configured. Request from creator via identity_request_resources." }] };
      }

      try {
        const resp = await httpRequest("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: auth,
          body: { text: content.slice(0, 280) },
        });

        journal.append({
          tick: stateStore.get().total_ticks,
          type: "action_result",
          action: "social_post",
          success: resp.ok,
          details: { content: content.slice(0, 100), status: resp.status },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: resp.ok
                ? `Tweet posted: "${content.slice(0, 100)}..."`
                : `Tweet failed (${resp.status}): ${JSON.stringify(resp.data)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Tweet error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "social_reply",
    label: "Reply to Tweet",
    description: "Reply to a specific tweet.",
    parameters: {
      type: "object",
      properties: {
        tweet_id: { type: "string", description: "ID of tweet to reply to" },
        content: { type: "string", description: "Reply text" },
      },
      required: ["tweet_id", "content"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const auth = getTwitterAuth();
      if (!auth) {
        return { details: {}, content: [{ type: "text", text: "Twitter credentials not configured." }] };
      }

      try {
        const resp = await httpRequest("https://api.twitter.com/2/tweets", {
          method: "POST",
          headers: auth,
          body: {
            text: (params.content as string).slice(0, 280),
            reply: { in_reply_to_tweet_id: params.tweet_id },
          },
        });

        return {
          details: {}, content: [
            { type: "text", text: resp.ok ? "Reply posted." : `Reply failed: ${resp.status}` },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Reply error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "social_trending",
    label: "Search Trending",
    description: "Search for trending topics or specific keywords on X/Twitter.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const auth = getTwitterAuth();
      if (!auth) {
        return { details: {}, content: [{ type: "text", text: "Twitter credentials not configured." }] };
      }

      const query = encodeURIComponent(params.query as string);
      const maxResults = (params.max_results as number) || 10;

      try {
        const resp = await httpRequest<any>(
          `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}`,
          { headers: auth },
        );

        if (!resp.ok || !resp.data?.data) {
          return { details: {}, content: [{ type: "text", text: `Search failed: ${resp.status}` }] };
        }

        const tweets = resp.data.data
          .map((t: any, i: number) => `  ${i + 1}. ${t.text?.slice(0, 100)}`)
          .join("\n");

        return {
          details: {}, content: [{ type: "text", text: `Search results for "${params.query}":\n${tweets}` }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Search error: ${msg}` }] };
      }
    },
  });
}
