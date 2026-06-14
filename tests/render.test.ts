import test from "node:test";
import assert from "node:assert/strict";

import { renderDailyBriefMarkdown } from "../src/renderers/markdown.ts";
import type { DailyBrief } from "../src/types.ts";

test("renderDailyBriefMarkdown includes market snapshot and clickable source links", () => {
  const brief: DailyBrief = {
    date: "2026-06-13",
    generatedAt: "2026-06-13T00:30:00.000Z",
    marketSnapshot: [
      {
        symbol: "NDX",
        name: "纳斯达克 100",
        changePercent: 0.8,
        status: "ok",
      },
    ],
    items: [
      {
        sourceId: "openai",
        sourceName: "OpenAI Blog",
        url: "https://openai.com/blog/model",
        canonicalUrl: "https://openai.com/blog/model",
        title: "OpenAI launches a new model",
        publishedAt: "2026-06-13T00:00:00.000Z",
        summary: "Official model launch.",
        language: "en",
        domainHint: "ai",
        dedupeKey: "openai launches a new model",
        localSignals: {
          sourceWeight: 1,
          freshnessScore: 1,
          duplicateCount: 1,
        },
        domain: "ai",
        contentType: "official",
        useTags: ["值得深读", "可做选题"],
        valueScore: 5,
        selected: true,
        recommendationReason: "官方发布，影响模型生态。",
      },
    ],
    sourceStats: {
      openai: 1,
    },
  };

  const markdown = renderDailyBriefMarkdown(brief);

  assert.match(markdown, /# 每日信息雷达 - 2026-06-13/);
  assert.match(markdown, /纳斯达克 100: \+0.80%/);
  assert.match(markdown, /\[OpenAI launches a new model\]\(https:\/\/openai.com\/blog\/model\)/);
  assert.match(markdown, /推荐理由：官方发布，影响模型生态。/);
});
