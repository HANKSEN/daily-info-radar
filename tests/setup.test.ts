import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { initializeSetup, inspectSetup } from "../src/setup.ts";

test("initializeSetup creates .env once and keeps data outside the repository", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-setup-"));
  const repoRoot = path.join(root, "daily-info-radar");
  const dataDir = path.join(root, "daily-info-radar.local-data");
  await mkdir(repoRoot);
  await writeFile(path.join(repoRoot, ".env.example"), "RADAR_AI_MODE=heuristic\n");

  const first = await initializeSetup({ repoRoot, dataDir });
  assert.equal(first.envCreated, true);
  assert.equal(await readFile(path.join(repoRoot, ".env"), "utf8"), "RADAR_AI_MODE=heuristic\n");

  await writeFile(path.join(repoRoot, ".env"), "RADAR_AI_MODE=openai\n");
  const second = await initializeSetup({ repoRoot, dataDir });
  assert.equal(second.envCreated, false);
  assert.equal(await readFile(path.join(repoRoot, ".env"), "utf8"), "RADAR_AI_MODE=openai\n");

  await rm(root, { recursive: true, force: true });
});

test("inspectSetup reports independent readiness stages without exposing secrets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-check-"));
  const repoRoot = path.join(root, "daily-info-radar");
  const dataDir = path.join(root, "daily-info-radar.local-data");
  await mkdir(repoRoot);
  await mkdir(dataDir);
  await writeFile(path.join(repoRoot, ".env"), "AI_API_KEY=super-secret-value\n");

  const report = await inspectSetup({
    repoRoot,
    dataDir,
    platform: "win32",
    nodeVersion: "25.1.0",
    schedulerInstalled: true,
    commandProbe: async () => true,
    env: {
      AI_BASE_URL: "https://api.example.com/v1",
      AI_API_KEY: "super-secret-value",
      AI_MODEL: "model",
      LARK_CHAT_ID: "oc_real",
      LARK_ALLOWED_CHAT_IDS: "oc_real",
      LARK_ALLOWED_SENDER_IDS: "ou_real",
    },
  });

  assert.equal(report.pipelineReady, true);
  assert.equal(report.deliveryReady, true);
  assert.equal(report.interactionReady, true);
  assert.equal(report.automationReady, true);
  assert.doesNotMatch(JSON.stringify(report), /super-secret-value/u);

  await rm(root, { recursive: true, force: true });
});

test("inspectSetup treats example placeholders as missing configuration", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-check-"));
  const repoRoot = path.join(root, "daily-info-radar");
  const dataDir = path.join(root, "daily-info-radar.local-data");
  await mkdir(repoRoot);
  await mkdir(dataDir);
  await writeFile(path.join(repoRoot, ".env"), "AI_API_KEY=replace-with-your-key\n");

  const report = await inspectSetup({
    repoRoot,
    dataDir,
    platform: "darwin",
    nodeVersion: "25.1.0",
    schedulerInstalled: false,
    commandProbe: async () => false,
    env: {
      AI_BASE_URL: "https://api.example.com/v1",
      AI_API_KEY: "replace-with-your-key",
      AI_MODEL: "model",
      LARK_CHAT_ID: "oc_replace_with_chat_id",
    },
  });

  assert.equal(report.pipelineReady, false);
  assert.equal(report.deliveryReady, false);
  assert.equal(report.automationReady, false);

  await rm(root, { recursive: true, force: true });
});

