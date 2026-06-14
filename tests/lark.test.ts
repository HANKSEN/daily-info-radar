import test from "node:test";
import assert from "node:assert/strict";

import { buildLarkMessageArgs, buildLarkSendArgs } from "../src/lark/send.ts";
import { renderDailyBriefLarkCard } from "../src/renderers/larkCard.ts";
import type { DailyBrief } from "../src/types.ts";

test("buildLarkSendArgs creates a bot markdown send command for the latest brief", () => {
  const args = buildLarkSendArgs({
    chatId: "oc_test",
    markdown: "# 每日信息雷达\n\n正文",
    idempotencyKey: "daily-2026-06-14",
  });

  assert.deepEqual(args, [
    "im",
    "+messages-send",
    "--as",
    "bot",
    "--chat-id",
    "oc_test",
    "--markdown",
    "# 每日信息雷达\n\n正文",
    "--idempotency-key",
    "daily-2026-06-14",
  ]);
});

test("buildLarkSendArgs supports direct user delivery", () => {
  const args = buildLarkSendArgs({
    userId: "ou_test",
    markdown: "hello",
    idempotencyKey: "daily-2026-06-14",
  });

  assert.ok(args.includes("--user-id"));
  assert.ok(args.includes("ou_test"));
});

test("buildLarkMessageArgs can send an interactive card", () => {
  const args = buildLarkMessageArgs({
    chatId: "oc_test",
    card: {
      config: { wide_screen_mode: true },
      elements: [],
    },
    idempotencyKey: "daily-2026-06-14",
  });

  assert.ok(args.includes("--msg-type"));
  assert.ok(args.includes("interactive"));
  assert.ok(args.includes("--content"));
  assert.doesNotThrow(() => JSON.parse(args[args.indexOf("--content") + 1]));
});

test("renderDailyBriefLarkCard includes clickable article links", () => {
  const card = renderDailyBriefLarkCard(createBrief());
  const serialized = JSON.stringify(card);

  assert.match(serialized, /每日信息雷达/);
  assert.match(serialized, /\[OpenAI update\]\(https:\/\/example.com\/openai\)/);
  assert.match(serialized, /市场快照/);
});

function createBrief(): DailyBrief {
  return {
    date: "2026-06-14",
    generatedAt: "2026-06-14T00:00:00.000Z",
    marketSnapshot: [
      {
        symbol: "NDX",
        name: "纳斯达克 100",
        changePercent: 1.2,
        status: "ok",
      },
    ],
    sourceStats: { openai: 1 },
    modelUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    items: [
      {
        sourceId: "openai",
        sourceName: "OpenAI Blog",
        sourceWeight: 1,
        title: "OpenAI update",
        url: "https://example.com/openai",
        canonicalUrl: "https://example.com/openai",
        dedupeKey: "openai update",
        domain: "ai",
        contentType: "official",
        useTags: ["值得深读"],
        valueScore: 5,
        selected: true,
        recommendationReason: "官方发布。",
        localSignals: {
          sourceWeight: 1,
          freshnessScore: 1,
          duplicateCount: 1,
        },
      },
    ],
  };
}
