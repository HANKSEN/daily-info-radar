import path from "node:path";
import { access, chmod, open, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { ensureStorage } from "./storage.ts";
import { launchdPlistPaths } from "./launchd.ts";
import { statusWindowsTasks } from "./windowsScheduler.ts";

export type SetupStage = "pipeline" | "delivery" | "interaction" | "automation";

export type SetupCheck = {
  id: string;
  stage: SetupStage;
  ok: boolean;
  detail: string;
  remediation?: string;
};

export type SetupReport = {
  platform: string;
  checks: SetupCheck[];
  pipelineReady: boolean;
  deliveryReady: boolean;
  interactionReady: boolean;
  automationReady: boolean;
  overallReady: boolean;
};

export type InspectSetupOptions = {
  repoRoot: string;
  dataDir: string;
  env: Record<string, string | undefined>;
  platform?: string;
  nodeVersion?: string;
  commandProbe?: (command: string, args: string[]) => Promise<boolean>;
  schedulerInstalled?: boolean;
};

export async function initializeSetup(input: {
  repoRoot: string;
  dataDir: string;
}): Promise<{ envPath: string; envCreated: boolean; dataDir: string }> {
  const envPath = path.join(input.repoRoot, ".env");
  const examplePath = path.join(input.repoRoot, ".env.example");
  let envCreated = false;

  try {
    const example = await readFile(examplePath, "utf8");
    const handle = await open(envPath, "wx", 0o600);
    try {
      await handle.writeFile(example, "utf8");
      envCreated = true;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "EEXIST") throw error;
  }

  if (process.platform !== "win32") {
    await chmod(envPath, 0o600).catch(() => undefined);
  }
  await ensureStorage(input.dataDir);
  return { envPath, envCreated, dataDir: input.dataDir };
}

export async function inspectSetup(options: InspectSetupOptions): Promise<SetupReport> {
  const platform = options.platform ?? process.platform;
  const probe = options.commandProbe ?? probeCommand;
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const larkCommand = "lark-cli";
  const [envExists, dataExists, larkCliInstalled, larkConfigured, installedScheduler] = await Promise.all([
    fileExists(path.join(options.repoRoot, ".env")),
    fileExists(options.dataDir),
    probe(larkCommand, ["--version"]),
    probe(larkCommand, ["doctor", "--offline"]),
    options.schedulerInstalled === undefined
      ? detectSchedulerInstalled(options.repoRoot, platform)
      : Promise.resolve(options.schedulerInstalled),
  ]);

  const aiMode = options.env.RADAR_AI_MODE === "heuristic" ? "heuristic" : "openai";
  const missingAi = aiMode === "heuristic"
    ? []
    : ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"].filter((key) => !isConfigured(options.env[key]));
  const schedulerSupported = platform === "darwin" || platform === "win32";
  const larkTargetConfigured = isConfigured(options.env.LARK_CHAT_ID)
    || isConfigured(options.env.LARK_USER_ID);

  const checks: SetupCheck[] = [
    check("node", "pipeline", nodeMajor(nodeVersion) >= 25, `Node.js ${nodeVersion}`, "Install Node.js 25 or newer."),
    check("env-file", "pipeline", envExists, envExists ? ".env exists" : ".env is missing", "Run npm run setup."),
    check("data-dir", "pipeline", dataExists, dataExists ? "Private data directory exists" : "Private data directory is missing", "Run npm run setup."),
    check(
      "ai",
      "pipeline",
      missingAi.length === 0,
      aiMode === "heuristic" ? "Heuristic mode; external AI is disabled" : missingAi.length === 0 ? "AI configuration is present" : `Missing AI settings: ${missingAi.join(", ")}`,
      "Fill the missing values locally in .env, or set RADAR_AI_MODE=heuristic.",
    ),
    check("lark-cli", "delivery", larkCliInstalled, larkCliInstalled ? "lark-cli is installed" : "lark-cli is missing", "Run npx @larksuite/cli@latest install."),
    check("lark-config", "delivery", larkConfigured, larkConfigured ? "lark-cli bot configuration is available" : "lark-cli is not configured", "Run lark-cli config init --new and complete the browser flow."),
    check("lark-target", "delivery", larkTargetConfigured, larkTargetConfigured ? "Feishu delivery target is configured" : "LARK_CHAT_ID or LARK_USER_ID is missing", "Capture a bot message event and fill the ID locally in .env."),
    check(
      "chat-allowlist",
      "interaction",
      isConfigured(options.env.LARK_ALLOWED_CHAT_IDS),
      isConfigured(options.env.LARK_ALLOWED_CHAT_IDS) ? "Chat allowlist is configured" : "Chat allowlist is missing",
      "Set LARK_ALLOWED_CHAT_IDS before enabling bot interaction.",
    ),
    check(
      "sender-allowlist",
      "interaction",
      isConfigured(options.env.LARK_ALLOWED_SENDER_IDS),
      isConfigured(options.env.LARK_ALLOWED_SENDER_IDS) ? "Sender allowlist is configured" : "Sender allowlist is missing",
      "Set LARK_ALLOWED_SENDER_IDS before enabling bot interaction.",
    ),
    check(
      "scheduler-support",
      "automation",
      schedulerSupported,
      schedulerSupported ? `Automatic scheduler is supported on ${platform}` : `No automatic scheduler for ${platform}`,
      "Use manual commands or add a platform scheduler adapter.",
    ),
    check(
      "scheduler-installed",
      "automation",
      schedulerSupported && installedScheduler,
      installedScheduler ? "Scheduler is installed" : "Scheduler is not installed",
      "Run npm run scheduler:install after pipeline and delivery checks pass.",
    ),
  ];

  const pipelineReady = stageReady(checks, "pipeline");
  const deliveryReady = pipelineReady && stageReady(checks, "delivery");
  const interactionReady = deliveryReady && stageReady(checks, "interaction");
  const automationReady = deliveryReady && stageReady(checks, "automation");
  return {
    platform,
    checks,
    pipelineReady,
    deliveryReady,
    interactionReady,
    automationReady,
    overallReady: interactionReady && automationReady,
  };
}

function check(
  id: string,
  stage: SetupStage,
  ok: boolean,
  detail: string,
  remediation: string,
): SetupCheck {
  return { id, stage, ok, detail, ...(ok ? {} : { remediation }) };
}

function stageReady(checks: SetupCheck[], stage: SetupStage): boolean {
  return checks.filter((item) => item.stage === stage).every((item) => item.ok);
}

function isConfigured(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return !/(replace|placeholder|your[-_ ]|_xxx|填写|绝对路径)/iu.test(value);
}

function nodeMajor(version: string): number {
  return Number.parseInt(version.replace(/^v/u, "").split(".")[0] ?? "0", 10);
}

async function detectSchedulerInstalled(repoRoot: string, platform: string): Promise<boolean> {
  if (platform === "darwin") {
    const paths = launchdPlistPaths();
    const [daily, bot] = await Promise.all([fileExists(paths.daily), fileExists(paths.bot)]);
    return daily && bot;
  }
  if (platform === "win32") {
    try {
      const status = await statusWindowsTasks(repoRoot) as {
        tasks?: Array<{ installed?: boolean }>;
      };
      return Boolean(status.tasks?.length) && status.tasks.every((task) => task.installed === true);
    } catch {
      return false;
    }
  }
  return false;
}

function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true, () => false);
}

function probeCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

