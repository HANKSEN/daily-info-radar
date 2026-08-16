import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLarkCliEnv,
  buildLarkMessageArgs,
  buildLarkSendArgs,
  normalizeIdempotencyKey,
} from "../src/lark/send.ts";
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

test("normalizeIdempotencyKey keeps Feishu keys within the field limit", () => {
  const input = `daily-info-radar-alert-${"incident".repeat(12)}`;
  const normalized = normalizeIdempotencyKey(input);

  assert.equal(normalized.length, 50);
  assert.equal(normalized, normalizeIdempotencyKey(input));
  assert.notEqual(normalized, normalizeIdempotencyKey(`${input}-other`));
});

test("renderDailyBriefLarkCard includes clickable article links", () => {
  const card = renderDailyBriefLarkCard(createBrief());
  const serialized = JSON.stringify(card);

  assert.match(serialized, /每日信息雷达/);
  assert.match(serialized, /生成时间.*2026 年 6 月 14 日 08:00:00/su);
  assert.match(serialized, /\[OpenAI update\]\(https:\/\/example.com\/openai\)/);
  assert.match(serialized, /市场快照/);
  assert.match(serialized, /column_set/u);
  assert.match(serialized, /快照时间.*2026 年 6 月 14 日 08:00:00/su);
  assert.match(serialized, /Yahoo Finance/u);
  assert.match(serialized, /\[纳斯达克 100 ETF（QQQM）\]\(https:\/\/finance\.yahoo\.com\/quote\/QQQM\)/u);
  assert.match(serialized, /美股.*纳斯达克 100.*标普 500.*道琼指数/su);
  assert.match(serialized, /沪深.*上证指数.*沪深 300.*创业板指/su);
  assert.match(serialized, /港股.*恒生指数/su);
  assert.match(serialized, /其他.*比特币.*黄金.*白银.*WTI 原油.*美元指数/su);
  assert.doesNotMatch(serialized, /英伟达/u);
});

test("buildLarkCliEnv disables proxy use for lark-cli subprocesses", () => {
  const env = buildLarkCliEnv({ LARK_CLI_NO_PROXY: "0", HTTPS_PROXY: "http://127.0.0.1:7897" });

  assert.equal(env.LARK_CLI_NO_PROXY, "1");
  assert.equal(env.HTTPS_PROXY, "http://127.0.0.1:7897");
});

function createBrief(): DailyBrief {
  return {
    date: "2026-06-14",
    generatedAt: "2026-06-14T00:00:00.000Z",
    marketSnapshot: [
      {
        symbol: "QQQM",
        name: "纳斯达克 100 ETF（QQQM）",
        region: "us",
        sourceName: "Yahoo Finance",
        sourceUrl: "https://finance.yahoo.com/quote/QQQM",
        fetchedAt: "2026-06-14T00:00:00.000Z",
        asOf: "2026-06-13T20:00:00.000Z",
        changePercent: 1.2,
        status: "ok",
      },
      { symbol: "^GSPC", name: "标普 500", region: "us", changePercent: 0.8, status: "ok" },
      { symbol: "^DJI", name: "道琼指数", region: "us", changePercent: -0.2, status: "ok" },
      { symbol: "000001.SS", name: "上证指数", region: "cn", changePercent: 0.2, status: "ok" },
      { symbol: "000300.SS", name: "沪深 300", region: "cn", changePercent: 0.3, status: "ok" },
      { symbol: "399006.SZ", name: "创业板指", region: "cn", changePercent: -0.5, status: "ok" },
      { symbol: "^HSI", name: "恒生指数", region: "hk", changePercent: 0.6, status: "ok" },
      { symbol: "BTC-USD", name: "比特币", region: "other", changePercent: 1.5, status: "ok" },
      { symbol: "GC=F", name: "黄金", region: "other", changePercent: 0.1, status: "ok" },
      { symbol: "SI=F", name: "白银", region: "other", changePercent: 0.4, status: "ok" },
      { symbol: "CL=F", name: "WTI 原油", region: "other", changePercent: -0.7, status: "ok" },
      { symbol: "DX-Y.NYB", name: "美元指数", region: "other", changePercent: 0.05, status: "ok" },
      { symbol: "NVDA", name: "英伟达", group: "tech_stock", changePercent: 2.1, status: "ok" },
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
