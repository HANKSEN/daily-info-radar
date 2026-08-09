import path from "node:path";
import { spawn } from "node:child_process";

export const windowsDailyTaskName = "DailyInfoRadar-Daily";
export const windowsBotTaskName = "DailyInfoRadar-Bot";

export type WindowsSchedulerOptions = {
  repoRoot: string;
  dataDir: string;
  nodePath: string;
  hour: number;
  minute: number;
};

export type WindowsTaskPlan = {
  daily: {
    taskName: string;
    trigger: string;
    scriptPath: string;
    wakeToRun: boolean;
    startWhenAvailable: boolean;
  };
  bot: {
    taskName: string;
    trigger: string;
    scriptPath: string;
    restartOnFailure: boolean;
  };
};

export function renderWindowsTaskPlan(options: WindowsSchedulerOptions): WindowsTaskPlan {
  validateSchedule(options.hour, options.minute);
  return {
    daily: {
      taskName: windowsDailyTaskName,
      trigger: `daily ${formatTime(options.hour, options.minute)}`,
      scriptPath: path.join(options.repoRoot, "scripts", "windows", "daily.ps1"),
      wakeToRun: true,
      startWhenAvailable: true,
    },
    bot: {
      taskName: windowsBotTaskName,
      trigger: "at user logon",
      scriptPath: path.join(options.repoRoot, "scripts", "windows", "bot.ps1"),
      restartOnFailure: true,
    },
  };
}

export async function installWindowsTasks(
  options: WindowsSchedulerOptions,
): Promise<{ plan: WindowsTaskPlan; stdout: string }> {
  const plan = renderWindowsTaskPlan(options);
  const stdout = await runWindowsSchedulerScript(options.repoRoot, "install.ps1", [
    "-RepoRoot",
    options.repoRoot,
    "-NodePath",
    options.nodePath,
    "-DataDir",
    options.dataDir,
    "-Hour",
    String(options.hour),
    "-Minute",
    String(options.minute),
  ]);
  return { plan, stdout };
}

export async function uninstallWindowsTasks(
  repoRoot: string,
): Promise<{ stdout: string }> {
  const stdout = await runWindowsSchedulerScript(repoRoot, "uninstall.ps1", []);
  return { stdout };
}

export async function statusWindowsTasks(
  repoRoot: string,
): Promise<unknown> {
  const stdout = await runWindowsSchedulerScript(repoRoot, "status.ps1", []);
  return JSON.parse(stdout.trim());
}

export function windowsSchedulerScriptArgs(
  repoRoot: string,
  scriptName: string,
  args: string[],
): string[] {
  return [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(repoRoot, "scripts", "windows", scriptName),
    ...args,
  ];
}

function runWindowsSchedulerScript(
  repoRoot: string,
  scriptName: string,
  args: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      windowsSchedulerScriptArgs(repoRoot, scriptName, args),
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`PowerShell scheduler script exited with ${code}: ${stderr || stdout}`));
    });
  });
}

function validateSchedule(hour: number, minute: number): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`RADAR_DAILY_HOUR must be an integer between 0 and 23: ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`RADAR_DAILY_MINUTE must be an integer between 0 and 59: ${minute}`);
  }
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

