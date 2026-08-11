import test from "node:test";
import assert from "node:assert/strict";

import { analyzeCandidatesWithOpenAI } from "../src/ai/openaiCompatible.ts";
import type { ArticleCandidate, RuntimeConfig } from "../src/types.ts";

test("AI analysis retries once when the first JSON response is malformed", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const content = calls === 1
      ? '{"items":['
      : JSON.stringify({
        items: [{
          index: 1,
          domain: "ai",
          contentType: "official",
          useTags: ["值得深读"],
          valueScore: 4,
          selected: true,
          recommendationReason: "官方更新值得关注。",
        }],
      });
    return new Response(JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }), { status: 200 });
  };

  try {
    const result = await analyzeCandidatesWithOpenAI([candidate()], config());
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].selected, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function config(): RuntimeConfig {
  return {
    repoRoot: "/repo",
    dataDir: "/data",
    timezone: "Asia/Shanghai",
    minItems: 10,
    maxItems: 20,
    candidatePoolMax: 80,
    maxPerSource: 8,
    ai: {
      mode: "openai",
      baseUrl: "https://api.example.com/v1",
      apiKey: "test-key",
      model: "test-model",
    },
    alerts: {
      enabled: true,
      minHealthySources: 10,
      maxSourceFailureRatio: 0.5,
      alertOnPartialSourceFailure: false,
    },
  };
}

function candidate(): ArticleCandidate {
  return {
    sourceId: "official",
    sourceName: "Official Blog",
    url: "https://example.com/update",
    canonicalUrl: "https://example.com/update",
    title: "Model update",
    publishedAt: "2026-08-11T00:00:00.000Z",
    dedupeKey: "model update",
    localSignals: {
      sourceWeight: 1,
      freshnessScore: 1,
      duplicateCount: 1,
    },
  };
}
