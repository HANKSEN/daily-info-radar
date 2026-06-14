import test from "node:test";
import assert from "node:assert/strict";

import { validateRuntimeReadiness } from "../src/runtimeReadiness.ts";

test("validateRuntimeReadiness reports missing env and unavailable sources", () => {
  const result = validateRuntimeReadiness({
    env: {},
    sourceCheck: {
      checked: 15,
      okCount: 0,
    },
  });

  assert.equal(result.ready, false);
  assert.ok(result.missingEnv.includes("AI_API_KEY"));
  assert.ok(result.issues.some((issue) => issue.includes("No sources are currently reachable")));
});

test("validateRuntimeReadiness passes when AI env and at least one source are available", () => {
  const result = validateRuntimeReadiness({
    env: {
      AI_BASE_URL: "https://api.example.com/v1",
      AI_API_KEY: "secret",
      AI_MODEL: "model",
    },
    sourceCheck: {
      checked: 15,
      okCount: 4,
    },
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.missingEnv, []);
});

test("validateRuntimeReadiness allows heuristic mode without AI credentials", () => {
  const result = validateRuntimeReadiness({
    env: { RADAR_AI_MODE: "heuristic" },
    sourceCheck: {
      checked: 15,
      okCount: 4,
    },
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.missingEnv, []);
});
