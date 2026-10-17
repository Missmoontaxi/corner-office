// Turns a registry model into an AI SDK language model on the active driver.
// Gateway is the default (OIDC in production, AI_GATEWAY_API_KEY locally). DRIVER=direct is the outage
// exit path and the weekly CI check, using the provider keys in the environment.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { policy } from "../policy";

export type Driver = "gateway" | "direct";

export function activeDriver(): Driver {
  return process.env.DRIVER === "direct" ? "direct" : "gateway";
}

let gw: ReturnType<typeof createGateway> | null = null;

export function languageModel(model: string, driver: Driver = activeDriver()): { model: LanguageModel; providerOptions: Record<string, Record<string, string[]>> } {
  const entry = policy().models.models[model];
  if (!entry) throw new Error(`Unknown model ${model}`);
  if (driver === "gateway") {
    gw ??= createGateway();
    // Pin each vendor's own host, so Claude never runs on Bedrock or Vertex and Paula's key is used.
    return { model: gw(entry.gateway), providerOptions: { gateway: { order: [entry.vendor], only: [entry.vendor] } } };
  }
  if (entry.vendor === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_EVAL_KEY;
    return { model: createAnthropic({ apiKey })(entry.direct), providerOptions: {} };
  }
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_EVAL_KEY;
  return { model: createOpenAI({ apiKey })(entry.direct), providerOptions: {} };
}

// List price in micro-dollars, used when the gateway does not report a market cost.
export function listCostMicroUsd(model: string, input: number, output: number) {
  const entry = policy().models.models[model]!;
  return Math.round(input * entry.in + output * entry.out);
}
