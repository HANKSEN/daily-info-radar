import { access } from "node:fs/promises";

import {
  launchdPlistPaths,
  loadLaunchdPlists,
  removeLaunchdPlists,
  renderLaunchdPlists,
  unloadLaunchdPlists,
  writeLaunchdPlists,
} from "./launchd.ts";
import {
  installWindowsTasks,
  renderWindowsTaskPlan,
  statusWindowsTasks,
  uninstallWindowsTasks,
  type WindowsSchedulerOptions,
} from "./windowsScheduler.ts";

export type SchedulerOptions = WindowsSchedulerOptions;
export type SchedulerKind = "launchd" | "windows-task-scheduler";

export function schedulerKindForPlatform(platform: string): SchedulerKind {
  if (platform === "darwin") return "launchd";
  if (platform === "win32") return "windows-task-scheduler";
  throw new Error(
    `Automatic scheduling is not supported on ${platform}. Run npm run daily and npm run send:latest manually.`,
  );
}

export function renderSchedulerPreview(
  options: SchedulerOptions,
  platform = process.platform,
): unknown {
  validateSchedulerTime(options);
  const kind = schedulerKindForPlatform(platform);
  if (kind === "launchd") {
    return { platform, kind, definitions: renderLaunchdPlists(options) };
  }
  return { platform, kind, plan: renderWindowsTaskPlan(options) };
}

export async function installScheduler(
  options: SchedulerOptions,
  platform = process.platform,
): Promise<unknown> {
  validateSchedulerTime(options);
  const kind = schedulerKindForPlatform(platform);
  if (kind === "launchd") {
    const paths = await writeLaunchdPlists(renderLaunchdPlists(options));
    await loadLaunchdPlists(paths);
    return { platform, kind, installed: true, paths };
  }
  const result = await installWindowsTasks(options);
  return { platform, kind, installed: true, ...result };
}

export async function uninstallScheduler(
  repoRoot: string,
  platform = process.platform,
): Promise<unknown> {
  const kind = schedulerKindForPlatform(platform);
  if (kind === "launchd") {
    const paths = launchdPlistPaths();
    await unloadLaunchdPlists(paths);
    await removeLaunchdPlists();
    return { platform, kind, installed: false, paths };
  }
  const result = await uninstallWindowsTasks(repoRoot);
  return { platform, kind, installed: false, ...result };
}

export async function schedulerStatus(
  repoRoot: string,
  platform = process.platform,
): Promise<unknown> {
  const kind = schedulerKindForPlatform(platform);
  if (kind === "launchd") {
    const paths = launchdPlistPaths();
    const [daily, bot] = await Promise.all([
      fileExists(paths.daily),
      fileExists(paths.bot),
    ]);
    return { platform, kind, daily: { installed: daily }, bot: { installed: bot }, paths };
  }
  const status = await statusWindowsTasks(repoRoot) as Record<string, unknown>;
  return { platform, kind, ...status };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateSchedulerTime(options: SchedulerOptions): void {
  if (!Number.isInteger(options.hour) || options.hour < 0 || options.hour > 23) {
    throw new Error(`RADAR_DAILY_HOUR must be an integer between 0 and 23: ${options.hour}`);
  }
  if (!Number.isInteger(options.minute) || options.minute < 0 || options.minute > 59) {
    throw new Error(`RADAR_DAILY_MINUTE must be an integer between 0 and 59: ${options.minute}`);
  }
}
