import { env } from "../../config/env.js";

const DEFAULT_MODELS = {
  openrouter: {
    large: "anthropic/claude-sonnet-4",
    small: "anthropic/claude-3.5-haiku",
  },
  anthropic: {
    large: "claude-sonnet-4-20250514",
    small: "claude-haiku-4-5-20251001",
  },
  openai: {
    large: "gpt-4o",
    small: "gpt-4o-mini",
  },
  gemini: {
    large: "gemini-2.5-pro",
    small: "gemini-2.5-flash",
  },
  ollama: {
    large: "llama3.1",
    small: "llama3.1",
  },
};

/**
 * Calls the configured LLM provider with a system prompt and user messages.
 * Returns { text, tokensIn, tokensOut, model }.
 */
export async function callLlm({ systemPrompt, messages, tier = "small" }) {
  const provider = env.AI_PROVIDER;
  const overrideModel = tier === "large" ? env.AI_MODEL_LARGE : env.AI_MODEL_SMALL;
  const model =
    overrideModel || DEFAULT_MODELS[provider]?.[tier] || DEFAULT_MODELS.openrouter[tier];

  if (provider !== "ollama" && !env.AI_API_KEY) {
    throw new Error(`AI_API_KEY is not configured for provider '${provider}'`);
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.FRONTEND_URL,
        "X-Title": "Sahlify",
      },
      body: JSON.stringify({
        model,
        provider: {
          zdr: env.AI_ZDR,
        },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `OpenRouter API error (${res.status})`);
    }
    return {
      text: data.choices?.[0]?.message?.content || "",
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      model: data.model || model,
    };
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.AI_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
    }
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return {
      text,
      tokensIn: data.usage?.input_tokens || 0,
      tokensOut: data.usage?.output_tokens || 0,
      model,
    };
  }

  if (provider === "openai" || provider === "ollama") {
    const url =
      provider === "ollama"
        ? "http://localhost:11434/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const headers = { "Content-Type": "application/json" };
    if (provider === "openai") headers.Authorization = `Bearer ${env.AI_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `${provider} API error (${res.status})`);
    }
    return {
      text: data.choices?.[0]?.message?.content || "",
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      model,
    };
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `Gemini API error (${res.status})`);
    }
    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      tokensIn: data.usageMetadata?.promptTokenCount || 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount || 0,
      model,
    };
  }

  throw new Error(`Unsupported AI_PROVIDER '${provider}'`);
}
