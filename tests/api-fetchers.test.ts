import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClsTelegraphUrl,
  parseClsTelegraph,
  parseHackerNewsItem,
  parseHuggingFaceDailyPapers,
  parseV2exTopics,
  parseWallstreetcnNews,
  parseZhihuHotList,
} from "../src/collectors/api.ts";
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

test("parseZhihuHotList maps hot-list payloads and stamps fetch time", () => {
  const source: SourceConfig = {
    id: "zhihu-hot",
    name: "知乎热榜",
    kind: "api",
    url: "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true",
    domainHint: "tech",
    weight: 0.65,
  };

  const items = parseZhihuHotList(
    {
      data: [
        {
          target: {
            title_area: { text: "AI 编程工具进入企业采购清单意味着什么？" },
            excerpt_area: { text: "讨论企业开发流程变化。" },
            metrics_area: { text: "1200 万热度" },
            link: { url: "https://www.zhihu.com/question/123" },
          },
        },
      ],
    },
    source,
    new Date("2026-06-15T00:00:00.000Z"),
  );

  assert.equal(items[0].sourceId, "zhihu-hot");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
  assert.match(items[0].summary ?? "", /1200 万热度/);
});

test("parseWallstreetcnNews maps information-flow payloads with publication time", () => {
  const source: SourceConfig = {
    id: "wallstreetcn-news",
    name: "华尔街见闻",
    kind: "api",
    url: "https://api-one.wallstcn.com/apiv1/content/information-flow",
    domainHint: "market",
    weight: 0.8,
  };

  const items = parseWallstreetcnNews(
    {
      data: {
        items: [
          {
            resource_type: "article",
            resource: {
              id: 1,
              title: "AI 芯片股财报带动科技板块波动",
              content_short: "市场关注云厂商资本开支。",
              display_time: 1781481600,
              uri: "/articles/123",
            },
          },
          {
            resource_type: "ad",
            resource: { id: 2, title: "广告", uri: "/articles/ad" },
          },
        ],
      },
    },
    source,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://wallstreetcn.com/articles/123");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
});

test("parseClsTelegraph maps telegraph payloads and filters ads", () => {
  const source: SourceConfig = {
    id: "cls-telegraph",
    name: "财联社电报",
    kind: "api",
    url: "https://www.cls.cn/v1/roll/get_roll_list",
    domainHint: "market",
    weight: 0.75,
  };

  const items = parseClsTelegraph(
    {
      data: {
        roll_data: [
          {
            id: 1,
            title: "半导体设备订单更新",
            brief: "行业订单出现边际变化。",
            shareurl: "https://www.cls.cn/detail/1",
            ctime: 1781481600,
            is_ad: 0,
          },
          { id: 2, title: "广告", ctime: 1781481600, is_ad: 1 },
        ],
      },
    },
    source,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].summary, "行业订单出现边际变化。");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
});

test("buildClsTelegraphUrl signs Cailianpress query parameters", () => {
  const url = buildClsTelegraphUrl(
    "https://www.cls.cn/v1/roll/get_roll_list",
    new Date("2026-06-15T00:00:00.000Z"),
  );

  assert.match(url, /^https:\/\/www\.cls\.cn\/v1\/roll\/get_roll_list\?/);
  assert.match(url, /last_time=1781481600/);
  assert.match(url, /sign=[a-f0-9]{32}/);
});
