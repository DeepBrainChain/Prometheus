/**
 * GitHub operations for the agent.
 * Create repos, push code, manage releases — build open source projects for reputation.
 * Registered as OpenClaw tools: github_create_repo, github_push_code, github_create_release
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerGithubTools(ctx: PrometheusContext): void {
  const { api, journal, stateStore } = ctx;

  function getGithubToken(): string | null {
    return process.env.GITHUB_TOKEN || null;
  }

  function githubHeaders(): Record<string, string> {
    const token = getGithubToken();
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  api.registerTool({
    name: "github_create_repo",
    label: "Create GitHub Repo",
    description: "Create a new GitHub repository. Use for open source projects to build credibility and value.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Repository name" },
        description: { type: "string", description: "Repository description" },
        private: { type: "boolean", description: "Whether repo is private (default false)" },
      },
      required: ["name", "description"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const token = getGithubToken();
      if (!token) {
        return { details: {}, content: [{ type: "text", text: "GitHub token not configured. Request from creator." }] };
      }

      try {
        const resp = await httpRequest<any>("https://api.github.com/user/repos", {
          method: "POST",
          headers: githubHeaders(),
          body: {
            name: params.name,
            description: params.description,
            private: params.private ?? false,
            auto_init: true,
          },
        });

        journal.append({
          tick: stateStore.get().total_ticks,
          type: "action_result",
          action: "github_create_repo",
          success: resp.ok,
          details: { repo: resp.data?.full_name, url: resp.data?.html_url },
        });

        if (resp.ok) {
          return {
            details: {}, content: [
              {
                type: "text",
                text: `Repository created: ${resp.data.html_url}\nClone: ${resp.data.clone_url}`,
              },
            ],
          };
        }
        return {
          details: {}, content: [{ type: "text", text: `Failed to create repo: ${JSON.stringify(resp.data)}` }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `GitHub error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "github_push_code",
    label: "Push Code to GitHub",
    description: "Create or update a file in a GitHub repository.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository full name (owner/repo)" },
        path: { type: "string", description: "File path in the repo" },
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message" },
      },
      required: ["repo", "path", "content", "message"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const token = getGithubToken();
      if (!token) {
        return { details: {}, content: [{ type: "text", text: "GitHub token not configured." }] };
      }

      const repo = params.repo as string;
      const filePath = params.path as string;
      const content = params.content as string;
      const message = params.message as string;

      try {
        // Check if file exists (to get SHA for update)
        let sha: string | undefined;
        const getResp = await httpRequest<any>(
          `https://api.github.com/repos/${repo}/contents/${filePath}`,
          { headers: githubHeaders() },
        );
        if (getResp.ok && getResp.data?.sha) {
          sha = getResp.data.sha;
        }

        // Create/update file
        const resp = await httpRequest<any>(
          `https://api.github.com/repos/${repo}/contents/${filePath}`,
          {
            method: "PUT",
            headers: githubHeaders(),
            body: {
              message,
              content: Buffer.from(content).toString("base64"),
              ...(sha ? { sha } : {}),
            },
          },
        );

        journal.append({
          tick: stateStore.get().total_ticks,
          type: "action_result",
          action: "github_push_code",
          success: resp.ok,
          details: { repo, path: filePath },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: resp.ok
                ? `File ${sha ? "updated" : "created"}: ${repo}/${filePath}`
                : `Push failed: ${JSON.stringify(resp.data)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `GitHub push error: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "github_create_release",
    label: "Create GitHub Release",
    description: "Create a release for a GitHub repository.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository full name (owner/repo)" },
        tag: { type: "string", description: "Release tag (e.g. 'v1.0.0')" },
        name: { type: "string", description: "Release name" },
        body: { type: "string", description: "Release notes" },
      },
      required: ["repo", "tag", "name"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const token = getGithubToken();
      if (!token) {
        return { details: {}, content: [{ type: "text", text: "GitHub token not configured." }] };
      }

      try {
        const resp = await httpRequest<any>(
          `https://api.github.com/repos/${params.repo}/releases`,
          {
            method: "POST",
            headers: githubHeaders(),
            body: {
              tag_name: params.tag,
              name: params.name,
              body: params.body || "",
            },
          },
        );

        return {
          details: {}, content: [
            {
              type: "text",
              text: resp.ok
                ? `Release created: ${resp.data.html_url}`
                : `Release failed: ${JSON.stringify(resp.data)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Release error: ${msg}` }] };
      }
    },
  });
}
