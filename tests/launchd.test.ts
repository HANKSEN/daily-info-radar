import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { launchdPlistPaths, renderLaunchdPlists, writeLaunchdPlists } from "../src/launchd.ts";

test("renderLaunchdPlists creates daily and bot launchd templates", () => {
  const plists = renderLaunchdPlists({
    repoRoot: "/repo/daily-info-radar",
    dataDir: "/repo/daily-info-radar.local-data",
    nodePath: "/usr/local/bin/node",
    hour: 8,
    minute: 0,
  });

  assert.match(plists.daily, /com\.hanksen\.daily-info-radar\.daily/);
  assert.match(plists.daily, /<key>StartCalendarInterval<\/key>/);
  assert.match(plists.daily, /\/opt\/homebrew\/bin:\/usr\/local\/bin/);
  assert.match(plists.daily, /<key>LARK_CLI_NO_PROXY<\/key>/);
  assert.match(plists.bot, /com\.hanksen\.daily-info-radar\.bot/);
  assert.match(plists.bot, /<key>KeepAlive<\/key>/);
  assert.match(plists.bot, /<key>PATH<\/key>/);
});

test("writeLaunchdPlists writes both agent files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-launchd-"));
  const plists = renderLaunchdPlists({
    repoRoot: "/repo/daily-info-radar",
    dataDir: "/repo/daily-info-radar.local-data",
    nodePath: "/usr/local/bin/node",
    hour: 8,
    minute: 0,
  });

  const paths = await writeLaunchdPlists(plists, dir);
  assert.deepEqual(paths, launchdPlistPaths(dir));
  assert.match(await readFile(paths.daily, "utf8"), /StartCalendarInterval/);
  assert.match(await readFile(paths.bot, "utf8"), /KeepAlive/);

  await rm(dir, { recursive: true, force: true });
});
