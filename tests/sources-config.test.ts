import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { loadSourceConfig } from "../src/config.ts";

test("loadSourceConfig expands RSSHub base URL placeholders", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "radar-sources-"));
  await mkdir(path.join(repoRoot, "config"));
  await writeFile(
    path.join(repoRoot, "config", "sources.example.json"),
    JSON.stringify({
      sources: [
        {
          id: "latepost",
          name: "晚点 LatePost",
          kind: "rss",
          url: "${RSSHUB_BASE_URL}/latepost",
          domainHint: "tech",
          enabled: true,
        },
      ],
    }),
  );

  const sources = await loadSourceConfig(repoRoot, {
    RSSHUB_BASE_URL: "https://rsshub.example.com/",
  });

  assert.equal(sources[0].url, "https://rsshub.example.com/latepost");

  await rm(repoRoot, { recursive: true, force: true });
});

test("loadSourceConfig uses the public RSSHub instance by default", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "radar-sources-"));
  await mkdir(path.join(repoRoot, "config"));
  await writeFile(
    path.join(repoRoot, "config", "sources.example.json"),
    JSON.stringify({
      sources: [
        {
          id: "latepost",
          name: "晚点 LatePost",
          kind: "rss",
          url: "${RSSHUB_BASE_URL}/latepost",
          domainHint: "tech",
          enabled: true,
        },
      ],
    }),
  );

  const sources = await loadSourceConfig(repoRoot, {});

  assert.equal(sources[0].url, "https://rsshub.app/latepost");

  await rm(repoRoot, { recursive: true, force: true });
});

test("default source config includes Chinese tech and AI sources", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..");

  const sources = await loadSourceConfig(repoRoot, {
    RSSHUB_BASE_URL: "https://rsshub.example.com",
  });

  const ids = sources.map((source) => source.id);
  assert.ok(ids.includes("latepost"));
  assert.ok(ids.includes("qbitai"));
  assert.ok(ids.includes("jiqizhixin"));
  assert.ok(ids.includes("ifanr"));
  assert.ok(ids.includes("sspai"));
  assert.ok(ids.includes("infoq-cn"));
});
