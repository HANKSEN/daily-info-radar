import test from "node:test";
import assert from "node:assert/strict";

import { parseGitHubTrendingHtml } from "../src/collectors/scrape.ts";
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
