import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  renderWindowsTaskPlan,
  windowsBotTaskName,
  windowsDailyTaskName,
  windowsSchedulerScriptArgs,
} from "../src/windowsScheduler.ts";

test("renderWindowsTaskPlan creates daily and bot task definitions", () => {
  const plan = renderWindowsTaskPlan({
    repoRoot: "C:\\Users\\Radar User\\daily-info-radar",
    dataDir: "C:\\Users\\Radar User\\daily-info-radar.local-data",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    hour: 8,
    minute: 5,
  });

  assert.equal(plan.daily.taskName, windowsDailyTaskName);
  assert.equal(plan.daily.trigger, "daily 08:05");
  assert.equal(plan.daily.wakeToRun, true);
  assert.equal(plan.daily.startWhenAvailable, true);
  assert.equal(plan.bot.taskName, windowsBotTaskName);
  assert.equal(plan.bot.restartOnFailure, true);
});

test("windowsSchedulerScriptArgs keeps paths as separate process arguments", () => {
  const repoRoot = path.join("C:\\Users", "Radar User", "daily-info-radar");
  const args = windowsSchedulerScriptArgs(repoRoot, "install.ps1", ["-Hour", "8"]);

  assert.deepEqual(args.slice(0, 4), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]);
  assert.equal(args[4], path.join(repoRoot, "scripts", "windows", "install.ps1"));
  assert.deepEqual(args.slice(5), ["-Hour", "8"]);
});

test("renderWindowsTaskPlan rejects invalid schedule values", () => {
  assert.throws(
    () => renderWindowsTaskPlan({
      repoRoot: "C:\\radar",
      dataDir: "C:\\radar-data",
      nodePath: "C:\\node.exe",
      hour: 24,
      minute: 0,
    }),
    /RADAR_DAILY_HOUR/u,
  );
});

test("Windows installer enables missed-run recovery, wake, and bot restart", async () => {
  const script = await readFile(
    new URL("../scripts/windows/install.ps1", import.meta.url),
    "utf8",
  );
  assert.match(script, /StartWhenAvailable/u);
  assert.match(script, /WakeToRun/u);
  assert.match(script, /RestartCount 999/u);
  assert.match(script, /RunOnlyIfNetworkAvailable/u);
  assert.match(script, /LogonType Interactive/u);
});

test("Windows daily wrapper uses the alert-aware scheduled command", async () => {
  const script = await readFile(new URL("../scripts/windows/daily.ps1", import.meta.url), "utf8");
  assert.match(script, /daily:scheduled/u);
  assert.doesNotMatch(script, /send:latest/u);
});
