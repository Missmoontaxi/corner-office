// Loads and validates the policy files once per process. Every trace records the versions.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ModelsPolicy, RoutingPolicy } from "./contracts";

const DIR = path.join(process.cwd(), "lib", "engine", "policy");

function load<T>(file: string, schema: { parse: (v: unknown) => T }): T {
  return schema.parse(YAML.parse(fs.readFileSync(path.join(DIR, file), "utf8")));
}

let cached: { models: ModelsPolicy; routing: RoutingPolicy } | null = null;

export function policy() {
  cached ??= { models: load("models.yaml", ModelsPolicy), routing: load("routing.yaml", RoutingPolicy) };
  return cached;
}

export function policyVersion() {
  const { models, routing } = policy();
  return `models ${models.version}, routing ${routing.version}`;
}
