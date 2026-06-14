import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { loadSourceConfig } from "../src/config.ts";

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

test("package exposes sources and sources:check scripts", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.sources, "node --experimental-strip-types src/cli.ts sources");
  assert.equal(packageJson.scripts["sources:check"], "node --experimental-strip-types src/cli.ts sources:check");
});
