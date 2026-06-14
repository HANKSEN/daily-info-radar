import os from "node:os";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

export type LaunchdOptions = {
  repoRoot: string;
  dataDir: string;
  nodePath: string;
  hour: number;
  minute: number;
};

export type LaunchdPlists = {
  daily: string;
  bot: string;
};

export type LaunchdPlistPaths = {
  daily: string;
  bot: string;
};

export const dailyLaunchdLabel = "com.hanksen.daily-info-radar.daily";
export const botLaunchdLabel = "com.hanksen.daily-info-radar.bot";

export function renderLaunchdPlists(options: LaunchdOptions): {
  daily: string;
  bot: string;
} {
  return {
    daily: renderPlist({
      label: dailyLaunchdLabel,
      repoRoot: options.repoRoot,
      dataDir: options.dataDir,
      nodePath: options.nodePath,
      args: ["src/cli.ts", "daily", "&&", "src/cli.ts", "send:latest"],
      calendar: { hour: options.hour, minute: options.minute },
      logName: "launchd-daily",
    }),
    bot: renderPlist({
      label: botLaunchdLabel,
      repoRoot: options.repoRoot,
      dataDir: options.dataDir,
      nodePath: options.nodePath,
      args: ["src/cli.ts", "bot"],
      keepAlive: true,
      logName: "launchd-bot",
    }),
  };
}

export function defaultLaunchAgentsDir(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents");
}

export function launchdPlistPaths(launchAgentsDir = defaultLaunchAgentsDir()): LaunchdPlistPaths {
  return {
    daily: path.join(launchAgentsDir, `${dailyLaunchdLabel}.plist`),
    bot: path.join(launchAgentsDir, `${botLaunchdLabel}.plist`),
  };
}

export async function writeLaunchdPlists(
  plists: LaunchdPlists,
  launchAgentsDir = defaultLaunchAgentsDir(),
): Promise<LaunchdPlistPaths> {
  await mkdir(launchAgentsDir, { recursive: true });
  const paths = launchdPlistPaths(launchAgentsDir);
  await writeFile(paths.daily, plists.daily, "utf8");
  await writeFile(paths.bot, plists.bot, "utf8");
  return paths;
}

export async function removeLaunchdPlists(
  launchAgentsDir = defaultLaunchAgentsDir(),
): Promise<LaunchdPlistPaths> {
  const paths = launchdPlistPaths(launchAgentsDir);
  await Promise.all([
    unlink(paths.daily).catch(ignoreMissing),
    unlink(paths.bot).catch(ignoreMissing),
  ]);
  return paths;
}

export async function loadLaunchdPlists(paths: LaunchdPlistPaths): Promise<void> {
  await bootoutLaunchdPlist(paths.daily);
  await bootoutLaunchdPlist(paths.bot);
  await bootstrapLaunchdPlist(paths.daily);
  await bootstrapLaunchdPlist(paths.bot);
}

export async function unloadLaunchdPlists(paths: LaunchdPlistPaths): Promise<void> {
  await bootoutLaunchdPlist(paths.daily);
  await bootoutLaunchdPlist(paths.bot);
}

function renderPlist(input: {
  label: string;
  repoRoot: string;
  dataDir: string;
  nodePath: string;
  args: string[];
  calendar?: { hour: number; minute: number };
  keepAlive?: boolean;
  logName: string;
}): string {
  const programArguments =
    input.label.endsWith(".daily")
      ? [
          "/bin/zsh",
          "-lc",
          `cd ${shellQuote(input.repoRoot)} && ${shellQuote(input.nodePath)} --experimental-strip-types src/cli.ts daily && ${shellQuote(input.nodePath)} --experimental-strip-types src/cli.ts send:latest`,
        ]
      : [
          input.nodePath,
          "--experimental-strip-types",
          `${input.repoRoot}/src/cli.ts`,
          "bot",
        ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${input.label}</string>
  <key>WorkingDirectory</key>
  <string>${input.repoRoot}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>RADAR_DATA_DIR</key>
    <string>${input.dataDir}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key>
    <string>${escapeXml(os.homedir())}</string>
    <key>LARK_CLI_NO_PROXY</key>
    <string>1</string>
  </dict>
  <key>ProgramArguments</key>
  <array>
${programArguments.map((arg) => `    <string>${escapeXml(arg)}</string>`).join("\n")}
  </array>
${input.calendar ? `  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${input.calendar.hour}</integer>
    <key>Minute</key>
    <integer>${input.calendar.minute}</integer>
  </dict>
` : ""}${input.keepAlive ? `  <key>KeepAlive</key>
  <true/>
` : ""}  <key>StandardOutPath</key>
  <string>${input.dataDir}/logs/${input.logName}.out.log</string>
  <key>StandardErrorPath</key>
  <string>${input.dataDir}/logs/${input.logName}.err.log</string>
</dict>
</plist>
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function bootstrapLaunchdPlist(plistPath: string): Promise<void> {
  await runLaunchctl(["bootstrap", `gui/${process.getuid?.() ?? os.userInfo().uid}`, plistPath]);
}

async function bootoutLaunchdPlist(plistPath: string): Promise<void> {
  await runLaunchctl(["bootout", `gui/${process.getuid?.() ?? os.userInfo().uid}`, plistPath], true);
}

function runLaunchctl(args: string[], allowFailure = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("launchctl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || allowFailure) resolve();
      else reject(new Error(`launchctl ${args.join(" ")} exited with ${code}: ${stderr}`));
    });
  });
}

function ignoreMissing(error: unknown): void {
  if ((error as { code?: string }).code !== "ENOENT") throw error;
}
