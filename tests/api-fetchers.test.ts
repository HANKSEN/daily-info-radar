import test from "node:test";
import assert from "node:assert/strict";

import { parseHackerNewsItem, parseHuggingFaceDailyPapers, parseV2exTopics } from "../src/collectors/api.ts";
import type { SourceConfig } from "../src/types.ts";

test("parseV2exTopics maps V2EX hot topic payloads into SourceItem records", () => {
  const source: SourceConfig = {
    id: "v2ex-hot",
    name: "V2EX 热门",
    kind: "api",
    url: "https://www.v2ex.com/api/topics/hot.json",
    domainHint: "tech",
    weight: 1,
  };

  const items = parseV2exTopics(
    [
      {
        id: 1,
        title: "大家最近在用什么本地优先笔记工具？",
        url: "https://www.v2ex.com/t/1",
        content: "讨论工程和效率工具",
        created: 1781481600,
      },
    ],
    source,
  );

  assert.equal(items[0].sourceId, "v2ex-hot");
  assert.equal(items[0].title, "大家最近在用什么本地优先笔记工具？");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
});

test("parseHackerNewsItem maps HN item payloads into SourceItem records", () => {
  const source: SourceConfig = {
    id: "hacker-news-top",
    name: "Hacker News Top",
    kind: "api",
    url: "https://hacker-news.firebaseio.com/v0/topstories.json",
    domainHint: "tech",
    weight: 1,
  };

  const item = parseHackerNewsItem(
    {
      id: 123,
      title: "Show HN: A tiny vector database",
      url: "https://example.com/vector-db",
      time: 1781481600,
      score: 240,
      descendants: 48,
    },
    source,
  );

  assert.equal(item?.url, "https://example.com/vector-db");
  assert.match(item?.summary ?? "", /score: 240/);
  assert.equal(item?.publishedAt, "2026-06-15T00:00:00.000Z");
});

test("parseHuggingFaceDailyPapers maps daily paper payloads into SourceItem records", () => {
  const source: SourceConfig = {
    id: "huggingface-daily-papers",
    name: "Hugging Face Daily Papers",
    kind: "api",
    url: "https://huggingface.co/api/daily_papers",
    domainHint: "ai",
    weight: 1.15,
  };

  const items = parseHuggingFaceDailyPapers(
    [
      {
        title: "Reasoning Models Learn Better Tool Use",
        paper: { id: "2606.12345", summary: "Tool-use benchmark paper." },
        publishedAt: "2026-06-15T01:00:00.000Z",
      },
    ],
    source,
  );

  assert.equal(items[0].url, "https://huggingface.co/papers/2606.12345");
  assert.equal(items[0].summary, "Tool-use benchmark paper.");
});
