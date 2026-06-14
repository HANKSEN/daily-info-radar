import test from "node:test";
import assert from "node:assert/strict";

import { parseRss } from "../src/collectors/rss.ts";

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
