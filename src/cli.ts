import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createDryRunFixture } from "./fixtures/dryRunFixture.ts";
import { collectDailyInputs } from "./collectors/index.ts";
import { loadDotEnv, loadRuntimeConfig, loadSourceConfig } from "./config.ts";
import { buildCandidates, runDailyPipeline } from "./pipeline.ts";
import { analyzeCandidatesHeuristically } from "./ai/heuristic.ts";
import { analyzeCandidatesWithOpenAI } from "./ai/openaiCompatible.ts";
import { rankArticles } from "./rank.ts";
import { renderDailyBriefMarkdown } from "./renderers/markdown.ts";
import { renderDailyBriefLarkCard } from "./renderers/larkCard.ts";
import {
  appendDailyRunLog,
  dailyPaths,
  ensureStorage,
  readLatestBrief,
  writeDailyArtifacts,
  writeJson,
} from "./storage.ts";
import { formatDateInTimezone } from "./date.ts";
import { checkSources, summarizeSources } from "./sources.ts";
import { validateRuntimeReadiness } from "./runtimeReadiness.ts";
import { buildLarkMessageArgs, sendLarkCard, sendLarkMarkdown } from "./lark/send.ts";
import { addBriefItemToReadingList } from "./obsidian.ts";
import { parseBotCommand, renderHelp } from "./bot/commands.ts";
import { parseLarkEventLine } from "./bot/events.ts";
import { rememberEventIfNew } from "./bot/eventDedupe.ts";
import {
  loadLaunchdPlists,
  removeLaunchdPlists,
  renderLaunchdPlists,
  unloadLaunchdPlists,
  writeLaunchdPlists,
} from "./launchd.ts";

const command = process.argv[2] ?? "help";
const flags = new Set(process.argv.slice(3));

try {
  await main(command, flags);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function main(commandName: string, cliFlags: Set<string>): Promise<void> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const env = await loadDotEnv(repoRoot);
  const config = loadRuntimeConfig({ repoRoot, env });

  if (commandName === "daily") {
    const dryRun = cliFlags.has("--dry-run");
    const fixture = dryRun ? createDryRunFixture() : undefined;
    const result = await runDailyPipeline({
      repoRoot: config.repoRoot,
      dataDir: config.dataDir,
      timezone: config.timezone,
      minItems: config.minItems,
      maxItems: config.maxItems,
      sourceItems: fixture?.sourceItems,
      marketSnapshots: fixture?.marketSnapshots,
      dryRun,
      config,
      sourceEnv: env,
    });
    console.log(JSON.stringify({ ok: true, date: result.brief.date, paths: result.paths }, null, 2));
    return;
  }

  if (commandName === "collect") {
    await collectCommand(config, env);
    return;
  }

  if (commandName === "analyze") {
    await analyzeCommand(config, cliFlags.has("--dry-run"));
    return;
  }

  if (commandName === "render") {
    const brief = await readLatestBrief(config.dataDir);
    const markdown = renderDailyBriefMarkdown(brief);
    const paths = dailyPaths(config.dataDir, brief.date);
    await writeFile(paths.briefMarkdown, markdown, "utf8");
    console.log(JSON.stringify({ ok: true, markdown: paths.briefMarkdown }, null, 2));
    return;
  }

  if (commandName === "sources") {
    const sources = await loadSourceConfig(config.repoRoot, env);
    console.log(JSON.stringify({ ok: true, sources: summarizeSources(sources) }, null, 2));
    return;
  }

  if (commandName === "sources:check") {
    const sources = await loadSourceConfig(config.repoRoot, env);
    const results = await checkSources(sources);
    const okCount = results.filter((result) => result.ok).length;
    console.log(JSON.stringify({ ok: true, checked: results.length, okCount, results }, null, 2));
    return;
  }

  if (commandName === "doctor") {
    const sources = await loadSourceConfig(config.repoRoot, env);
    const results = await checkSources(sources);
    const readiness = validateRuntimeReadiness({
      env,
      sourceCheck: {
        checked: results.length,
        okCount: results.filter((result) => result.ok).length,
      },
    });
    console.log(JSON.stringify({ ok: true, readiness, sources: results }, null, 2));
    return;
  }

  if (commandName === "send:latest") {
    await sendLatestCommand(config, env, cliFlags);
    return;
  }

  if (commandName === "obsidian:add") {
    await obsidianAddCommand(config, env);
    return;
  }

  if (commandName === "bot") {
    await botCommand(config, env, cliFlags);
    return;
  }

  if (commandName === "launchd:print") {
    const plists = renderConfiguredLaunchdPlists(config, env);
    console.log(JSON.stringify({ ok: true, plists }, null, 2));
    return;
  }

  if (commandName === "launchd:install") {
    const plists = renderConfiguredLaunchdPlists(config, env);
    const paths = await writeLaunchdPlists(plists);
    if (cliFlags.has("--load")) await loadLaunchdPlists(paths);
    console.log(JSON.stringify({ ok: true, loaded: cliFlags.has("--load"), paths }, null, 2));
    return;
  }

  if (commandName === "launchd:uninstall") {
    const paths = await removeLaunchdPlists();
    if (cliFlags.has("--unload")) await unloadLaunchdPlists(paths);
    console.log(JSON.stringify({ ok: true, unloaded: cliFlags.has("--unload"), paths }, null, 2));
    return;
  }

  console.log("Usage: npm run daily[:dry] | npm run collect | npm run analyze | npm run render | npm run sources | npm run sources:check | npm run doctor | npm run send:latest | npm run obsidian:add | npm run bot | npm run launchd:print | npm run launchd:install | npm run launchd:uninstall");
}

async function collectCommand(
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
): Promise<void> {
  await ensureStorage(config.dataDir);
  const date = formatDateInTimezone(new Date(), config.timezone);
  const sources = await loadSourceConfig(config.repoRoot, env);
  const inputs = await collectDailyInputs(sources);
  const candidates = buildCandidates(inputs.sourceItems, {
    candidatePoolMax: config.candidatePoolMax,
    maxPerSource: config.maxPerSource,
  });
  const paths = dailyPaths(config.dataDir, date);
  await writeJson(paths.raw, inputs);
  await writeJson(paths.candidates, candidates);
  await writeJson(path.join(config.dataDir, "state", "latest-candidates.json"), {
    date,
    raw: paths.raw,
    candidates: paths.candidates,
  });
  console.log(JSON.stringify({ ok: true, date, candidates: paths.candidates }, null, 2));
}

async function analyzeCommand(
  config: ReturnType<typeof loadRuntimeConfig>,
  dryRun: boolean,
): Promise<void> {
  const latest = JSON.parse(
    await readFile(path.join(config.dataDir, "state", "latest-candidates.json"), "utf8"),
  ) as { date: string; raw: string; candidates: string };
  const raw = JSON.parse(await readFile(latest.raw, "utf8")) as Awaited<
    ReturnType<typeof collectDailyInputs>
  >;
  const candidates = JSON.parse(await readFile(latest.candidates, "utf8"));
  const analysis = dryRun || config.ai.mode === "heuristic"
    ? { articles: analyzeCandidatesHeuristically(candidates), usage: undefined }
    : await analyzeCandidatesWithOpenAI(candidates, config);
  const analyzed = analysis.articles;
  const items = rankArticles(analyzed, { minItems: config.minItems, maxItems: config.maxItems });
  const modelUsage = normalizeUsage(analysis.usage);
  const brief = {
    date: latest.date,
    generatedAt: new Date().toISOString(),
    marketSnapshot: raw.marketSnapshots,
    items,
    sourceStats: Object.fromEntries(
      raw.sourceItems.map((item) => [
        item.sourceId,
        raw.sourceItems.filter((sourceItem) => sourceItem.sourceId === item.sourceId).length,
      ]),
    ),
    modelUsage,
  };
  const markdown = renderDailyBriefMarkdown(brief);
  const paths = await writeDailyArtifacts({
    dataDir: config.dataDir,
    date: latest.date,
    raw,
    candidates,
    analyzed,
    brief,
    markdown,
  });
  await appendDailyRunLog(config.dataDir, {
    date: latest.date,
    generatedAt: brief.generatedAt,
    aiMode: dryRun ? "heuristic" : config.ai.mode,
    model: !dryRun && config.ai.mode === "openai" ? config.ai.model : undefined,
    apiBaseUrl: !dryRun && config.ai.mode === "openai" ? config.ai.baseUrl : undefined,
    tokenUsage: modelUsage,
    sourceItemCount: raw.sourceItems.length,
    sourceCount: Object.keys(brief.sourceStats).length,
    candidateCount: Array.isArray(candidates) ? candidates.length : 0,
    selectedItemCount: items.length,
    briefMarkdown: paths.briefMarkdown,
  });
  console.log(JSON.stringify({ ok: true, date: latest.date, paths }, null, 2));
}

async function sendLatestCommand(
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
  cliFlags: Set<string>,
): Promise<void> {
  const brief = await readLatestBrief(config.dataDir);
  const markdown = await readFile(dailyPaths(config.dataDir, brief.date).briefMarkdown, "utf8");
  const card = renderDailyBriefLarkCard(brief);
  const target = larkTargetFromArgs() ?? larkTargetFromEnv(env);
  const idempotencyKey = cliFlags.has("--force")
    ? `daily-info-radar-${brief.date}-${Date.now()}`
    : `daily-info-radar-${brief.date}`;
  if (cliFlags.has("--dry-run")) {
    const args = cliFlags.has("--markdown")
      ? buildLarkMessageArgs({ ...target, markdown, idempotencyKey })
      : buildLarkMessageArgs({ ...target, card, idempotencyKey });
    console.log(JSON.stringify({ ok: true, dryRun: true, args }, null, 2));
    return;
  }
  const result = cliFlags.has("--markdown")
    ? await sendLarkMarkdown({ ...target, markdown, idempotencyKey })
    : await sendLarkCard({ ...target, card, idempotencyKey });
  console.log(JSON.stringify({ ok: true, date: brief.date, result }, null, 2));
}

async function obsidianAddCommand(
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
): Promise<void> {
  const itemNumber = readNumberArg("--item") ?? readNumberArg("--number") ?? readFirstPositionalNumber();
  if (!itemNumber) throw new Error("Missing item number. Example: npm run obsidian:add -- --item 3");
  const filePath = env.OBSIDIAN_READING_LIST_FILE;
  if (!filePath) throw new Error("Missing OBSIDIAN_READING_LIST_FILE in .env");
  const brief = await readLatestBrief(config.dataDir);
  const result = await addBriefItemToReadingList({ brief, itemNumber, filePath });
  console.log(JSON.stringify({ ok: true, itemNumber, ...result }, null, 2));
}

async function botCommand(
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
  cliFlags: Set<string>,
): Promise<void> {
  if (cliFlags.has("--dry-run")) {
    console.log(JSON.stringify({ ok: true, dryRun: true, event: "im.message.receive_v1" }, null, 2));
    return;
  }

  const args = ["event", "consume", "im.message.receive_v1", "--as", "bot"];
  const timeout = readStringArg("--timeout");
  if (timeout) args.push("--timeout", timeout);
  const child = spawn("lark-cli", args, { stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");

  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/u);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      void handleBotEventLine(line, config, env).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lark-cli event consume exited with ${code}`));
    });
  });
}

async function handleBotEventLine(
  line: string,
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
): Promise<void> {
  if (!line.trim()) return;
  const event = parseLarkEventLine(line);
  if (!event) return;
  const dedupe = await rememberEventIfNew({
    stateFile: path.join(config.dataDir, "state", "processed-lark-events.txt"),
    eventId: event.eventId ?? event.messageId,
  });
  if (dedupe.duplicate) return;
  if (!isAllowed(event.chatId, env.LARK_ALLOWED_CHAT_IDS)) return;
  if (!isAllowed(event.senderId, env.LARK_ALLOWED_SENDER_IDS)) return;

  const command = parseBotCommand(event.text);
  const target = event.chatId ? { chatId: event.chatId } : larkTargetFromEnv(env);
  if (command.type === "collect") {
    const filePath = env.OBSIDIAN_READING_LIST_FILE;
    if (!filePath) throw new Error("Missing OBSIDIAN_READING_LIST_FILE in .env");
    const brief = await readLatestBrief(config.dataDir);
    const results = [];
    for (const itemNumber of command.itemNumbers) {
      results.push(await addBriefItemToReadingList({ brief, itemNumber, filePath }));
    }
    await sendLarkMarkdown({
      ...target,
      markdown: `已处理待读：${results.map((result) => result.status).join(", ")}`,
      idempotencyKey: `radar-bot-${Date.now()}`,
    });
    return;
  }
  if (command.type === "resend") {
    const brief = await readLatestBrief(config.dataDir);
    await sendLarkCard({
      ...target,
      card: renderDailyBriefLarkCard(brief),
      idempotencyKey: `daily-info-radar-${brief.date}-${Date.now()}`,
    });
    return;
  }
  if (command.type === "status") {
    const brief = await readLatestBrief(config.dataDir);
    const latestRun = await readLatestRun(config.dataDir);
    const usage = latestRun?.tokenUsage ?? normalizeUsage(brief.modelUsage);
    const aiLabel = latestRun?.aiMode === "openai"
      ? `模型：${latestRun.model ?? "unknown"}`
      : "模型：heuristic（未调用外部 AI）";
    await sendLarkMarkdown({
      ...target,
      markdown: [
        "信息雷达运行中。",
        `最新日报：${brief.date}`,
        `条目数：${brief.items.length}`,
        aiLabel,
        `Token：${usage.totalTokens}（prompt ${usage.promptTokens} / completion ${usage.completionTokens}）`,
      ].join("\n"),
      idempotencyKey: `radar-status-${Date.now()}`,
    });
    return;
  }
  if (command.type === "help") {
    await sendLarkMarkdown({ ...target, markdown: renderHelp(), idempotencyKey: `radar-help-${Date.now()}` });
  }
}

function larkTargetFromEnv(env: Record<string, string | undefined>): { chatId: string } | { userId: string } {
  if (env.LARK_CHAT_ID) return { chatId: env.LARK_CHAT_ID };
  if (env.LARK_USER_ID) return { userId: env.LARK_USER_ID };
  throw new Error("Missing LARK_CHAT_ID or LARK_USER_ID in .env. You can also pass --chat-id or --user-id.");
}

function larkTargetFromArgs(): { chatId: string } | { userId: string } | undefined {
  const chatId = readStringArg("--chat-id");
  if (chatId) return { chatId };
  const userId = readStringArg("--user-id");
  if (userId) return { userId };
  return undefined;
}

function isAllowed(value: string | undefined, csv: string | undefined): boolean {
  if (!csv) return true;
  if (!value) return false;
  return csv.split(",").map((item) => item.trim()).includes(value);
}

function readStringArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readNumberArg(name: string): number | undefined {
  const value = readStringArg(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readFirstPositionalNumber(): number | undefined {
  const value = process.argv.slice(3).find((arg) => /^\d+$/u.test(arg));
  return value ? Number(value) : undefined;
}

function normalizeUsage(usage: {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
} | undefined): { promptTokens: number; completionTokens: number; totalTokens: number } {
  return {
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  };
}

async function readLatestRun(dataDir: string): Promise<{
  aiMode?: string;
  model?: string;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
} | undefined> {
  try {
    return JSON.parse(await readFile(path.join(dataDir, "state", "latest-run.json"), "utf8"));
  } catch {
    return undefined;
  }
}

function renderConfiguredLaunchdPlists(
  config: ReturnType<typeof loadRuntimeConfig>,
  env: Record<string, string | undefined>,
): ReturnType<typeof renderLaunchdPlists> {
  return renderLaunchdPlists({
    repoRoot: config.repoRoot,
    dataDir: config.dataDir,
    nodePath: process.execPath,
    hour: Number(env.RADAR_DAILY_HOUR ?? 8),
    minute: Number(env.RADAR_DAILY_MINUTE ?? 0),
  });
}
