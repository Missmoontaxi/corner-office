import { defineConfig } from "vitest/config";

// Unit tests live next to the code. Playwright owns tests/.
export default defineConfig({ test: { include: ["lib/**/*.test.ts", "scripts/**/*.test.ts", "evals/**/*.test.ts"] } });
