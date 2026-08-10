import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadSourceConfig } from "../src/config.ts";
import { checkSources } from "../src/sources.ts";

test("default source config uses rss, api, and scrape source kinds", async () => {
  const sources = await loadSourceConfig(repoRoot(), {
    RSSHUB_BASE_URL: "https://rsshub.example.com",
  });
  const kinds = new Set(sources.map((source) => source.kind));

  assert.ok(kinds.has("rss"));
  assert.ok(kinds.has("api"));
  assert.ok(kinds.has("scrape"));
});

test("source config carries metadata fields for grouping and diagnostics", async () => {
  const sources = await loadSourceConfig(repoRoot(), {
    RSSHUB_BASE_URL: "https://rsshub.example.com",
  });
  const latepost = sources.find((source) => source.id === "latepost");

  assert.equal(latepost?.subcategory, "商业科技");
  assert.equal(latepost?.lang, "zh");
  assert.deepEqual(latepost?.locales, ["zh-CN"]);
  assert.match(latepost?.notes ?? "", /RSSHub/);
  assert.equal(typeof latepost?.useCurl, "boolean");
});

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

test("package exposes source, setup, verification, and scheduler scripts", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.sources, "node --experimental-strip-types src/cli.ts sources");
  assert.equal(packageJson.scripts["sources:check"], "node --experimental-strip-types src/cli.ts sources:check");
  assert.equal(packageJson.scripts.setup, "node --experimental-strip-types src/cli.ts setup");
  assert.equal(packageJson.scripts["setup:check"], "node --experimental-strip-types src/cli.ts setup:check");
  assert.match(packageJson.scripts.verify, /src\/cli\.ts verify/u);
  assert.equal(packageJson.scripts["daily:scheduled"], "node --experimental-strip-types src/cli.ts daily:scheduled");
  assert.equal(packageJson.scripts["scheduler:install"], "node --experimental-strip-types src/cli.ts scheduler:install");
});

test("checkSources reports RSS fallback health when primary URL fails", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("huggingface.co")) throw new Error("fetch failed");
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const [result] = await checkSources([
      {
        id: "huggingface-blog",
        name: "Hugging Face Blog",
        kind: "rss",
        url: "https://huggingface.co/blog/feed.xml",
      },
    ], { curlFallback: false });

    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
    assert.match(result.checkedUrl ?? "", /www\.bestblogs\.dev\/en\/feeds\/rss/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkSources can validate GitHub Trending through API fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("github.com/trending")) throw new Error("timeout");
    if (url.includes("api.github.com/search/repositories")) {
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const [result] = await checkSources([
      {
        id: "github-trending",
        name: "GitHub Trending",
        kind: "scrape",
        url: "https://github.com/trending?since=daily",
      },
    ], { curlFallback: false });

    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
    assert.match(result.checkedUrl ?? "", /api\.github\.com\/search\/repositories/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
