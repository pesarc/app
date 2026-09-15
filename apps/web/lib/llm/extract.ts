// Model-agnostic structured extraction.
//
// The agent's language understanding runs through any provider, chosen by env
// — no hard dependency on one model or vendor. Two backends cover essentially
// everything:
//   • openai   — any OpenAI-compatible /chat/completions endpoint. This is the
//                de-facto standard and covers OpenAI, Cencori (the hackathon's
//                AI partner), Groq, OpenRouter, Together, local Ollama, etc.
//   • anthropic — native Anthropic Messages API.
//
// Env:
//   LLM_PROVIDER   openai | anthropic        (default: auto-detect from keys)
//   LLM_BASE_URL   OpenAI-compatible base    (e.g. https://api.cencori.com/v1)
//   LLM_API_KEY    key for the chosen provider
//   LLM_MODEL      model id                  (e.g. gpt-4o-mini, claude-…, llama-…)
//
// Back-compat: ANTHROPIC_API_KEY still works and selects the anthropic backend.

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema object for the tool's arguments. */
  parameters: Record<string, unknown>;
};

export type ToolCall = { name: string; input: Record<string, unknown> };

type Provider = "openai" | "anthropic";

function resolveProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "anthropic") return explicit;
  // Auto-detect: an OpenAI-compatible base URL wins; else fall back to Anthropic.
  if (process.env.LLM_BASE_URL) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "openai";
}

export function llmConfigured(): boolean {
  const p = resolveProvider();
  if (p === "anthropic") return Boolean(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
}

/**
 * Forces the model to call exactly one of `tools` and returns the chosen call.
 * Provider-agnostic: callers define neutral ToolSpecs and never see the vendor.
 */
export async function extractTool(
  system: string,
  userMessage: string,
  tools: ToolSpec[],
): Promise<ToolCall> {
  return resolveProvider() === "anthropic"
    ? viaAnthropic(system, userMessage, tools)
    : viaOpenAI(system, userMessage, tools);
}

// ---- OpenAI-compatible (covers Cencori, OpenAI, Groq, OpenRouter, Ollama…) ----
async function viaOpenAI(system: string, userMessage: string, tools: ToolSpec[]): Promise<ToolCall> {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("LLM_API_KEY is not set");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "required",
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
  };
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.name) throw new Error("Model returned no tool call");
  let input: Record<string, unknown> = {};
  try {
    input = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    /* leave empty; caller validates */
  }
  return { name: call.name, input };
}

// ---- native Anthropic ----
async function viaAnthropic(system: string, userMessage: string, tools: ToolSpec[]): Promise<ToolCall> {
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  const model = process.env.LLM_MODEL || "claude-sonnet-4-5";
  if (!apiKey) throw new Error("Anthropic API key is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 120)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; name?: string; input?: Record<string, unknown> }[];
  };
  const call = data.content?.find((b) => b.type === "tool_use");
  if (!call?.name) throw new Error("Model returned no tool call");
  return { name: call.name, input: call.input ?? {} };
}
