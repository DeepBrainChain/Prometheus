/**
 * HTTP request utilities for the agent.
 * Used by capabilities that need to call external APIs.
 */

export interface HttpResponse<T = unknown> {
  status: number;
  ok: boolean;
  data: T;
  headers: Record<string, string>;
}

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Make an HTTP request with timeout and error handling.
 */
export async function httpRequest<T = unknown>(
  url: string,
  opts: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  const { method = "GET", headers = {}, body, timeoutMs = 30_000 } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOpts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      signal: controller.signal,
    };

    if (body !== undefined && method !== "GET") {
      fetchOpts.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);

    let data: T;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = (await response.json()) as T;
    } else {
      data = (await response.text()) as unknown as T;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: responseHeaders,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * BoxHire LLM API (OpenAI-compatible chat completion).
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmCallOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: LlmToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call BoxHire LLM API for CEO decision-making.
 */
export async function callLlm(
  apiUrl: string,
  apiKey: string,
  jwt: string,
  options: LlmCallOptions,
): Promise<ChatCompletionResponse> {
  const { model = "deepseek-ai/DeepSeek-V3", ...rest } = options;

  const response = await httpRequest<ChatCompletionResponse>(
    `${apiUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(jwt ? { "X-Auth-Token": jwt } : {}),
      },
      body: { model, ...rest },
      timeoutMs: 120_000, // LLM calls can be slow
    },
  );

  if (!response.ok) {
    throw new Error(
      `LLM call failed (${response.status}): ${JSON.stringify(response.data)}`,
    );
  }

  return response.data;
}
