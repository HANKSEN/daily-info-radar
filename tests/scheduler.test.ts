import test from "node:test";
import assert from "node:assert/strict";

import { renderSchedulerPreview, schedulerKindForPlatform } from "../src/scheduler.ts";

const options = {
  repoRoot: "/repo/daily-info-radar",
  dataDir: "/repo/daily-info-radar.local-data",
  nodePath: "/usr/local/bin/node",
  hour: 8,
  minute: 0,
};

test("schedulerKindForPlatform maps macOS and Windows", () => {
  assert.equal(schedulerKindForPlatform("darwin"), "launchd");
  assert.equal(schedulerKindForPlatform("win32"), "windows-task-scheduler");
});

test("renderSchedulerPreview returns a Windows task plan", () => {
  const preview = renderSchedulerPreview(options, "win32") as {
    kind: string;
    plan: { daily: { trigger: string } };
  };
  assert.equal(preview.kind, "windows-task-scheduler");
  assert.equal(preview.plan.daily.trigger, "daily 08:00");
});

test("unsupported platforms fail with manual command guidance", () => {
  assert.throws(() => schedulerKindForPlatform("linux"), /npm run daily/u);
});

test("generic scheduler rejects invalid macOS schedule values", () => {
  assert.throws(
    () => renderSchedulerPreview({ ...options, minute: 60 }, "darwin"),
    /RADAR_DAILY_MINUTE/u,
  );
});
