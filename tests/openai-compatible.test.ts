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
    const result = await analyzeCandidatesWithOpenAI(
      [candidate()],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].selected, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis splits a large candidate pool into bounded requests and sums usage", async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    requestBodies.push(body as unknown as Record<string, unknown>);
    const prompt = JSON.parse(body.messages[1].content) as {
      candidates: Array<{ index: number; summary?: string }>;
    };
    return aiResponse({ items: [validItem(prompt.candidates[0].index)] });
  };

  try {
    const candidates = Array.from({ length: 41 }, (_, index) => candidate(index + 1, "x".repeat(2000)));
    const result = await analyzeCandidatesWithOpenAI(candidates, config(), { retryDelaysMs: [] });

    assert.equal(requestBodies.length, 3);
    assert.deepEqual(result.articles.map((article) => article.title), [
      "Model update 1",
      "Model update 21",
      "Model update 41",
    ]);
    assert.deepEqual(result.usage, {
      promptTokens: 30,
      completionTokens: 15,
      totalTokens: 45,
    });

    for (const requestBody of requestBodies) {
      const messages = requestBody.messages as Array<{ content: string }>;
      const prompt = JSON.parse(messages[1].content) as {
        candidates: Array<{ summary?: string }>;
      };
      assert.ok(prompt.candidates.length <= 20);
      assert.ok(prompt.candidates.every((item) => (item.summary?.length ?? 0) <= 603));
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis recovers complete items from a truncated JSON response", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const firstItem = JSON.stringify(validItem(1));
    return aiResponse(`{"items":[${firstItem},{"index":2,"domain":"ai"`);
  };

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate(1), candidate(2)],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(calls, 1);
    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].title, "Model update 1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis ignores invalid items while preserving valid items", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => aiResponse({
    items: [
      validItem(1),
      { ...validItem(999), recommendationReason: "未知候选条目" },
      { ...validItem(2), valueScore: 9 },
    ],
  });

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate(1), candidate(2)],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].title, "Model update 1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis preserves successful batches when another batch stays malformed", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let calls = 0;
  console.warn = () => {};
  globalThis.fetch = async () => {
    calls += 1;
    if (calls <= 3) return aiResponse('{"items":[');
    return aiResponse({ items: [validItem(21)] });
  };

  try {
    const candidates = Array.from({ length: 21 }, (_, index) => candidate(index + 1));
    const result = await analyzeCandidatesWithOpenAI(candidates, config(), { retryDelaysMs: [] });
    assert.equal(calls, 4);
    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].title, "Model update 21");
    assert.deepEqual(result.usage, {
      promptTokens: 40,
      completionTokens: 20,
      totalTokens: 60,
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("AI analysis retries when the HTTP response envelope is not JSON", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let calls = 0;
  const warnings: string[] = [];
  console.warn = (message) => warnings.push(String(message));
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("upstream gateway is warming up", {
        status: 200,
        headers: {
          "content-type": "text/plain",
          "x-request-id": "request-123",
        },
      });
    }
    return aiResponse({ items: [validItem(1)] });
  };

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate()],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
    assert.match(warnings[0], /HTTP 外层响应/u);
    assert.match(warnings[0], /content_type=text\/plain/u);
    assert.match(warnings[0], /request_id=request-123/u);
    assert.doesNotMatch(warnings[0], /upstream gateway/u);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("AI analysis accepts an unexpected SSE response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const content = JSON.stringify({ items: [validItem(1)] });
    const first = content.slice(0, Math.floor(content.length / 2));
    const second = content.slice(first.length);
    const body = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: first } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: second }, finish_reason: "stop" }] })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate()],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(result.articles.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis retries a timed-out request and preserves request diagnostics", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const warnings: string[] = [];
  let calls = 0;
  console.warn = (message) => warnings.push(String(message));
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error("request timed out");
      error.name = "TimeoutError";
      throw error;
    }
    return aiResponse({ items: [validItem(1)] });
  };

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate()],
      config(),
      { retryDelaysMs: [], requestTimeoutMs: 25 },
    );
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
    assert.match(warnings[0], /AI 服务连接超时/u);
    assert.match(warnings[0], /code=AI_TIMEOUT/u);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("AI analysis retries a transient server error", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let calls = 0;
  console.warn = () => {};
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response("temporary upstream failure", { status: 503 });
    return aiResponse({ items: [validItem(1)] });
  };

  try {
    const result = await analyzeCandidatesWithOpenAI(
      [candidate()],
      config(),
      { retryDelaysMs: [] },
    );
    assert.equal(calls, 2);
    assert.equal(result.articles.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test("AI analysis does not retry authentication failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('{"error":{"message":"invalid api key"}}', { status: 401 });
  };

  try {
    await assert.rejects(
      analyzeCandidatesWithOpenAI(
        [candidate()],
        config(),
        { retryDelaysMs: [] },
      ),
      /AI API 鉴权失败/u,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI analysis reports the final timeout after three failed attempts", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let calls = 0;
  console.warn = () => {};
  globalThis.fetch = async () => {
    calls += 1;
    const error = new Error("request timed out");
    error.name = "TimeoutError";
    throw error;
  };

  try {
    await assert.rejects(
      analyzeCandidatesWithOpenAI(
        [candidate()],
        config(),
        { retryDelaysMs: [], requestTimeoutMs: 25 },
      ),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "AI_TIMEOUT");
        const cause = (error as Error).cause as Error;
        assert.match(cause.message, /batch=1/u);
        assert.match(cause.message, /attempt=3/u);
        assert.match(cause.message, /timeout_ms=25/u);
        return true;
      },
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
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

function candidate(index = 1, summary?: string): ArticleCandidate {
  return {
    sourceId: "official",
    sourceName: "Official Blog",
    url: `https://example.com/update-${index}`,
    canonicalUrl: `https://example.com/update-${index}`,
    title: `Model update ${index}`,
    publishedAt: "2026-08-11T00:00:00.000Z",
    summary,
    dedupeKey: `model update ${index}`,
    localSignals: {
      sourceWeight: 1,
      freshnessScore: 1,
      duplicateCount: 1,
    },
  };
}

function validItem(index: number) {
  return {
    index,
    domain: "ai",
    contentType: "official",
    useTags: ["值得深读"],
    valueScore: 4,
    selected: true,
    recommendationReason: "官方更新值得关注。",
  };
}

function aiResponse(content: string | object): Response {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { content: typeof content === "string" ? content : JSON.stringify(content) },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }), { status: 200 });
}
