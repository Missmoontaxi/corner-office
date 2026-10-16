// Direct-driver check. One plain call and one structured-output call per pinned text model,
// straight to Anthropic and OpenAI with the CI eval keys, no gateway.
// Runs in CI (direct-models workflow). A provider whose key is missing is reported as skipped.
// The model list moves into lib/engine/policy/models.yaml once the registry exists.
import { generateText, jsonSchema, Output } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

const MODELS = [
  { id: "claude-haiku-5-5", provider: "anthropic", effort: "low" },
  { id: "claude-sonnet-5-5", provider: "anthropic", effort: "low" },
  { id: "claude-opus-5-5", provider: "anthropic", effort: "medium" },
  { id: "gpt-6-luna", provider: "openai", effort: "low" },
  { id: "gpt-6.1-sol", provider: "openai", effort: "low" },
];

const Card = jsonSchema({
  type: "object",
  properties: { headline: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] } },
  required: ["headline", "priority"],
  additionalProperties: false,
});

// Key hygiene by length and shape only, since double pastes have happened. Never print the key.
function keyCheck(name) {
  const raw = process.env[name];
  if (!raw) return { name, present: false };
  return { name, present: true, length: raw.length, whitespace: /\s/.test(raw), repeated: raw.length % 2 === 0 && raw.slice(0, raw.length / 2) === raw.slice(raw.length / 2) };
}

let lastBody = null;
const capture = async (url, init) => {
  lastBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  return fetch(url, init);
};
const keys = { anthropic: keyCheck("ANTHROPIC_EVAL_KEY"), openai: keyCheck("OPENAI_EVAL_KEY") };
const providers = {
  anthropic: keys.anthropic.present ? createAnthropic({ apiKey: process.env.ANTHROPIC_EVAL_KEY.trim(), fetch: capture }) : null,
  openai: keys.openai.present ? createOpenAI({ apiKey: process.env.OPENAI_EVAL_KEY.trim(), fetch: capture }) : null,
};

for (const k of Object.values(keys)) console.log(JSON.stringify({ key: k }));

let failures = 0;
for (const m of MODELS) {
  const p = providers[m.provider];
  if (!p) {
    console.log(JSON.stringify({ model: m.id, result: "skipped", reason: `no ${m.provider} key` }));
    continue;
  }
  const row = { model: m.id, effort: m.effort };
  try {
    const r = await generateText({ model: p(m.id), reasoning: m.effort, prompt: "Reply with the single word OK." });
    Object.assign(row, { plain: "ok", respModel: r.response.modelId, out: r.usage.outputTokens, think: r.usage.outputTokenDetails?.reasoningTokens ?? 0 });
  } catch (e) {
    failures++;
    Object.assign(row, { plain: "fail", error: String(e?.responseBody ?? e?.message).slice(0, 300) });
  }
  try {
    const r = await generateText({ model: p(m.id), reasoning: m.effort, output: Output.object({ schema: Card }), prompt: "Make a tiny brief card about a dentist appointment moved to Thursday." });
    const sent = Object.keys(lastBody ?? {});
    const mode = sent.includes("output_config") ? "output_config" : sent.includes("text") || sent.includes("response_format") ? "json_schema" : sent.includes("tool_choice") ? "forced_tool" : "other";
    Object.assign(row, { structured: r.output?.headline ? "ok" : "empty", mode, sentKeys: sent.filter((k) => !["messages", "input", "model"].includes(k)) });
  } catch (e) {
    failures++;
    Object.assign(row, { structured: "fail", error: String(e?.responseBody ?? e?.message).slice(0, 300) });
  }
  console.log(JSON.stringify(row));
}

if (failures) {
  console.error(`${failures} direct-driver check(s) failed`);
  process.exit(1);
}
