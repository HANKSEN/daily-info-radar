import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeUrl, normalizeSourceItem } from "../src/normalize.ts";
import { dedupeCandidates } from "../src/dedupe.ts";
import type { SourceItem } from "../src/types.ts";

test("canonicalizeUrl strips tracking noise and fragments", () => {
  const url = canonicalizeUrl(
    "https://example.com/news/ai?utm_source=x&id=42&utm_campaign=y#comments",
  );

  assert.equal(url, "https://example.com/news/ai?id=42");
});

test("dedupeCandidates merges duplicate URLs and normalized titles", () => {
  const items: SourceItem[] = [
    {
      sourceId: "openai",
      sourceName: "OpenAI Blog",
      title: "OpenAI launches a new model",
      url: "https://openai.com/blog/model?utm_source=x",
      publishedAt: "2026-06-13T00:00:00.000Z",
      summary: "Official model launch.",
      domainHint: "ai",
      sourceWeight: 1.2,
    },
    {
      sourceId: "hn",
      sourceName: "Hacker News",
      title: "OpenAI launches a new model!",
      url: "https://openai.com/blog/model#discussion",
      publishedAt: "2026-06-13T00:05:00.000Z",
      summary: "Discussion of the launch.",
      domainHint: "ai",
      sourceWeight: 1,
    },
    {
      sourceId: "market",
      sourceName: "Market Feed",
      title: "Nasdaq 100 futures rise before open",
      url: "https://markets.example.com/nasdaq-100",
      publishedAt: "2026-06-13T00:10:00.000Z",
      summary: "Market snapshot.",
      domainHint: "market",
    },
  ];

  const candidates = items.map((item) => normalizeSourceItem(item));
  const deduped = dedupeCandidates(candidates);

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].localSignals.duplicateCount, 2);
  assert.equal(deduped[0].canonicalUrl, "https://openai.com/blog/model");
  assert.equal(deduped[0].localSignals.sourceWeight, 1.2);
});

test("normalizeSourceItem carries sourceWeight into local signals", () => {
  const candidate = normalizeSourceItem({
    sourceId: "latepost",
    sourceName: "晚点 LatePost",
    title: "一家 AI 公司正在重塑企业软件",
    url: "https://example.com/latepost/ai-saas",
    sourceWeight: 1.2,
    domainHint: "tech",
  });

  assert.equal(candidate.localSignals.sourceWeight, 1.2);
});
