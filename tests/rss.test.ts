import test from "node:test";
import assert from "node:assert/strict";

import { collectRssSource, parseRss } from "../src/collectors/rss.ts";

test("parseRss preserves configured source weight on each item", () => {
  const items = parseRss(
    `
    <rss>
      <channel>
        <item>
          <title>晚点报道一家公司新的 AI 产品线</title>
          <link>https://www.latepost.com/news/ai-product</link>
          <description>中文商业科技报道</description>
          <pubDate>Sat, 13 Jun 2026 08:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
    `,
    {
      id: "latepost",
      name: "晚点 LatePost",
      kind: "rss",
      url: "https://rsshub.app/latepost",
      domainHint: "tech",
      weight: 1.2,
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceWeight, 1.2);
});

test("collectRssSource falls back for Hugging Face blog RSS failures", async () => {
  const requestedUrls: string[] = [];
  const fetcher = async (url: string) => {
    requestedUrls.push(url);
    if (url === "https://huggingface.co/blog/feed.xml") {
      throw new TypeError("fetch failed");
    }
    return {
      text: `
      <rss>
        <channel>
          <item>
            <title>Hugging Face fallback article</title>
            <link>https://huggingface.co/blog/fallback</link>
            <pubDate>Mon, 15 Jun 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
      `,
      status: 200,
      viaCurl: false,
    };
  };

  const items = await collectRssSource({
      id: "huggingface-blog",
      name: "Hugging Face Blog",
      kind: "rss",
      url: "https://huggingface.co/blog/feed.xml",
      domainHint: "ai",
      weight: 1.1,
    }, fetcher);

  assert.deepEqual(requestedUrls, [
    "https://huggingface.co/blog/feed.xml",
    "https://www.bestblogs.dev/en/feeds/rss?category=ai&minScore=90",
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Hugging Face fallback article");
  assert.equal(items[0].sourceId, "bestblogs-ai-high-score");
  assert.equal(items[0].sourceName, "BestBlogs AI 高分内容");
});
