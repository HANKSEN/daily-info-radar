import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { loadRuntimeConfig } from "../src/config.ts";

test("uses a sibling local-data directory by default", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-repo-"));
  const repoRoot = path.join(root, "daily-info-radar");

  const config = loadRuntimeConfig({
    repoRoot,
    env: {},
  });

  assert.equal(config.repoRoot, repoRoot);
  assert.equal(config.dataDir, path.join(root, "daily-info-radar.local-data"));
  assert.notEqual(path.dirname(config.dataDir), repoRoot);

  await rm(root, { recursive: true, force: true });
});

test("RADAR_DATA_DIR overrides the default data directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-repo-"));
  const repoRoot = path.join(root, "daily-info-radar");
  const dataDir = path.join(root, "private-runtime-data");

  const config = loadRuntimeConfig({
    repoRoot,
    env: { RADAR_DATA_DIR: dataDir },
  });

  assert.equal(config.dataDir, dataDir);

  await rm(root, { recursive: true, force: true });
});

test("RADAR_AI_MODE can switch daily analysis to heuristic mode", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-repo-"));
  const repoRoot = path.join(root, "daily-info-radar");

  const config = loadRuntimeConfig({
    repoRoot,
    env: { RADAR_AI_MODE: "heuristic" },
  });

  assert.equal(config.ai.mode, "heuristic");

  await rm(root, { recursive: true, force: true });
});

test("alert settings use conservative defaults", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-config-"));
  const config = loadRuntimeConfig({ repoRoot: path.join(root, "repo"), env: {} });

  assert.equal(config.alerts.enabled, true);
  assert.equal(config.alerts.minHealthySources, 10);
  assert.equal(config.alerts.maxSourceFailureRatio, 0.5);
  assert.equal(config.alerts.alertOnPartialSourceFailure, false);

  await rm(root, { recursive: true, force: true });
});
