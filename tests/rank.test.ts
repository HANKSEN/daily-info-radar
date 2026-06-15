import test from "node:test";
import assert from "node:assert/strict";

import { rankArticles } from "../src/rank.ts";
import type { AnalyzedArticle } from "../src/types.ts";

test("rankArticles does not backfill low-quality items when selected items are below minItems", () => {
  const ranked = rankArticles(
    [
      article("high", { selected: true, valueScore: 5 }),
      article("threshold", { selected: true, valueScore: 3 }),
      article("low-selected", { selected: true, valueScore: 2 }),
      article("high-unselected", { selected: false, valueScore: 5 }),
    ],
    { minItems: 10, maxItems: 20 },
  );

  assert.deepEqual(
    ranked.map((item) => item.sourceId),
    ["high", "threshold"],
  );
});

test("rankArticles excludes negative-reason items even when the model marks them selected", () => {
  const ranked = rankArticles(
    [
      article("good", { selected: true, valueScore: 3, recommendationReason: "技术变化值得跟踪。" }),
      article("weak", { selected: true, valueScore: 3, recommendationReason: "信号一般。" }),
      article("not-core", {
        selected: true,
        valueScore: 4,
        recommendationReason: "非核心科技新闻。",
      }),
    ],
    { minItems: 10, maxItems: 20 },
  );

  assert.deepEqual(
    ranked.map((item) => item.sourceId),
    ["good"],
  );
});

function article(
  id: string,
  overrides: Pick<AnalyzedArticle, "selected" | "valueScore"> &
    Partial<Pick<AnalyzedArticle, "recommendationReason">>,
): AnalyzedArticle {
  return {
    sourceId: id,
    sourceName: id,
    url: `https://example.com/${id}`,
    title: id,
    canonicalUrl: `https://example.com/${id}`,
    dedupeKey: id,
    domain: "tech",
    contentType: "news",
    useTags: ["持续关注"],
    recommendationReason: "Relevant technical signal.",
    publishedAt: "2026-06-15T00:00:00.000Z",
    localSignals: {
      sourceWeight: 1,
      freshnessScore: 1,
      duplicateCount: 1,
    },
    ...overrides,
  };
}
