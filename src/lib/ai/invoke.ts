import { anthropic } from "./claude";

// Shared low-level Claude call and JSON handling, used by both the outreach
// generators and the playbook generator.

export function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
}

export function parseJson<T>(raw: string): T {
  return JSON.parse(stripFences(raw)) as T;
}

// Attempts to close an incomplete JSON string caused by token-limit truncation.
// Walks the text tracking string/escape/nesting state, then closes open structures.
export function repairTruncatedJson(raw: string): string {
  const s = stripFences(raw);
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (const ch of s) {
    if (escape)                      { escape = false; continue; }
    if (ch === "\\" && inString)     { escape = true;  continue; }
    if (ch === '"')                  { inString = !inString; continue; }
    if (inString)                    continue;
    if (ch === "{" || ch === "[")    stack.push(ch);
    else if (ch === "}" || ch === "]") { if (stack.length) stack.pop(); }
  }

  let out = s.trimEnd();
  if (inString) out += '"';
  out = out.replace(/[,:\s]+$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === "{" ? "}" : "]";
  }
  return out;
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  // cache_control is a prompt-caching beta field not yet typed in this SDK version
  const systemBlock = {
    type: "text" as const,
    text: systemPrompt,
    cache_control: { type: "ephemeral" },
  };

  const msg = await anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      // SDK v0.39 doesn't type prompt-caching system blocks
      system: [systemBlock] as Parameters<typeof anthropic.messages.create>[0]["system"],
      messages: [{ role: "user", content: userPrompt }],
    },
    { headers: { "anthropic-beta": "prompt-caching-2024-07-31" } }
  );

  const content = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const tokensUsed = msg.usage.input_tokens + msg.usage.output_tokens;

  return { content, tokensUsed };
}
