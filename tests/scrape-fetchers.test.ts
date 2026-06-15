import test from "node:test";
import assert from "node:assert/strict";

import {
  parseGitHubTrendingHtml,
  parseGitHubSearchRepositories,
  parseLlamaIndexBlogHtml,
  parseWeiboHotHtml,
} from "../src/collectors/scrape.ts";
import type { SourceConfig } from "../src/types.ts";

test("parseGitHubTrendingHtml extracts repositories from GitHub Trending HTML", () => {
  const source: SourceConfig = {
    id: "github-trending",
    name: "GitHub Trending",
    kind: "scrape",
    url: "https://github.com/trending",
    domainHint: "tech",
    weight: 1,
  };
  const html = `
    <article class="Box-row">
      <h2><a href="/owner/repo">owner / repo</a></h2>
      <p>A useful developer tool for local AI workflows.</p>
    </article>
  `;

  const items = parseGitHubTrendingHtml(html, source, new Date("2026-06-15T00:00:00.000Z"));

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "owner/repo");
  assert.equal(items[0].url, "https://github.com/owner/repo");
  assert.equal(items[0].summary, "A useful developer tool for local AI workflows.");
});

test("parseGitHubSearchRepositories maps GitHub API fallback results", () => {
  const source: SourceConfig = {
    id: "github-trending",
    name: "GitHub Trending",
    kind: "scrape",
    url: "https://github.com/trending",
    domainHint: "tech",
    weight: 1,
  };

  const items = parseGitHubSearchRepositories(
    {
      items: [
        {
          full_name: "owner/repo",
          html_url: "https://github.com/owner/repo",
          description: "A useful developer tool.",
          stargazers_count: 1200,
          language: "TypeScript",
          pushed_at: "2026-06-15T00:00:00.000Z",
        },
      ],
    },
    source,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "owner/repo");
  assert.equal(items[0].url, "https://github.com/owner/repo");
  assert.match(items[0].summary ?? "", /fallback: GitHub Search API/);
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
});

test("parseWeiboHotHtml extracts hot search items from Weibo HTML", () => {
  const source: SourceConfig = {
    id: "weibo-hot",
    name: "微博热搜",
    kind: "scrape",
    url: "https://s.weibo.com/top/summary?cate=realtimehot",
    domainHint: "tech",
    weight: 0.55,
  };
  const html = `
    <table>
      <tbody>
        <tr><td class="td-01">1</td><td class="td-02"><a href="/weibo?q=AI%E5%85%AC%E5%8F%B8">AI 公司发布新模型</a></td><td class="td-03">热</td></tr>
        <tr><td class="td-01">2</td><td class="td-02"><a href="javascript:void(0);">无效链接</a></td><td class="td-03"></td></tr>
      </tbody>
    </table>
  `;

  const items = parseWeiboHotHtml(html, source, new Date("2026-06-15T00:00:00.000Z"));

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "AI 公司发布新模型");
  assert.equal(items[0].url, "https://s.weibo.com/weibo?q=AI%E5%85%AC%E5%8F%B8");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
  assert.match(items[0].summary ?? "", /热/);
});

test("parseLlamaIndexBlogHtml extracts blog links and publication dates", () => {
  const source: SourceConfig = {
    id: "llamaindex-blog",
    name: "LlamaIndex Blog",
    kind: "scrape",
    url: "https://www.llamaindex.ai/blog",
    domainHint: "ai",
    weight: 1.1,
  };
  const html = `
    <section>
      <a href="/blog/agentic-rag">Agentic RAG in production</a>
      <p>Jun 15, 2026</p>
      <a href="/blog/agentic-rag">Agentic RAG in production</a>
      <a href="https://www.llamaindex.ai/blog/parsebench">Introducing ParseBench</a>
      <span>Apr 13, 2026</span>
    </section>
  `;

  const items = parseLlamaIndexBlogHtml(html, source);

  assert.equal(items.length, 2);
  assert.equal(items[0].url, "https://www.llamaindex.ai/blog/agentic-rag");
  assert.equal(items[0].publishedAt, "2026-06-15T00:00:00.000Z");
  assert.equal(items[1].url, "https://www.llamaindex.ai/blog/parsebench");
});
