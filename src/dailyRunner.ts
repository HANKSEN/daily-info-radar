import type { LarkTarget } from "./lark/send.ts";
import { sendLarkCard } from "./lark/send.ts";
import { larkTargetFromEnv } from "./lark/target.ts";
import {
  classifyOperationalError,
  createIncident,
  RadarOperationalError,
} from "./operationalError.ts";
import { formatDateInTimezone } from "./date.ts";
import { resolveLatestIncident, writeDailyIncident } from "./incidents.ts";
import { runDailyPipeline } from "./pipeline.ts";
import { renderDailyBriefLarkCard } from "./renderers/larkCard.ts";
import { renderIncidentLarkCard } from "./renderers/larkAlertCard.ts";
import { appendDailyRunLog } from "./storage.ts";
import type {
  DailyIncident,
  PipelineResult,
  RuntimeConfig,
  SourceHealth,
} from "./types.ts";

export type ScheduledDailyResult = {
  date: string;
  briefSent: true;
  warningSent: boolean;
  pipeline: PipelineResult;
};

export type ScheduledDailyDependencies = {
  runPipeline?: typeof runDailyPipeline;
  sendCard?: typeof sendLarkCard;
  appendRunLog?: typeof appendDailyRunLog;
  writeIncident?: typeof writeDailyIncident;
  resolveIncident?: typeof resolveLatestIncident;
};

export async function runScheduledDaily(input: {
  config: RuntimeConfig;
  env: Record<string, string | undefined>;
  now?: Date;
  target?: LarkTarget;
  forceDelivery?: boolean;
  dependencies?: ScheduledDailyDependencies;
}): Promise<ScheduledDailyResult> {
  const now = input.now ?? new Date();
  const date = formatDateInTimezone(now, input.config.timezone);
  const target = input.target ?? larkTargetFromEnv(input.env);
  const deps = {
    runPipeline: input.dependencies?.runPipeline ?? runDailyPipeline,
    sendCard: input.dependencies?.sendCard ?? sendLarkCard,
    appendRunLog: input.dependencies?.appendRunLog ?? appendDailyRunLog,
    writeIncident: input.dependencies?.writeIncident ?? writeDailyIncident,
    resolveIncident: input.dependencies?.resolveIncident ?? resolveLatestIncident,
  };
  let stage: "collect" | "deliver" = "collect";
  let sourceHealth: SourceHealth | undefined;

  try {
    const pipeline = await deps.runPipeline({
      repoRoot: input.config.repoRoot,
      dataDir: input.config.dataDir,
      timezone: input.config.timezone,
      minItems: input.config.minItems,
      maxItems: input.config.maxItems,
      now,
      config: input.config,
      sourceEnv: input.env,
    });
    sourceHealth = pipeline.sourceHealth;
    stage = "deliver";
    await deps.sendCard({
      ...target,
      card: renderDailyBriefLarkCard(pipeline.brief),
      idempotencyKey: input.forceDelivery
        ? `daily-info-radar-${pipeline.brief.date}-${now.getTime()}`
        : `daily-info-radar-${pipeline.brief.date}`,
    });

    await deps.resolveIncident(input.config.dataDir, now);
    const warningSent = await maybeSendSourceWarning({
      config: input.config,
      target,
      date,
      now,
      health: sourceHealth,
      sendCard: deps.sendCard,
      writeIncident: deps.writeIncident,
    });
    return { date, briefSent: true, warningSent, pipeline };
  } catch (error) {
    const operational = classifyOperationalError(error, stage);
    const incident = createIncident({ error: operational, date, now });
    if (!incident.sourceHealth && sourceHealth) incident.sourceHealth = sourceHealth;

    if (input.config.alerts.enabled) {
      try {
        await deps.sendCard({
          ...target,
          card: renderIncidentLarkCard(incident),
          idempotencyKey: `daily-info-radar-alert-${incident.id}`,
        });
        incident.alertSent = true;
      } catch (alertError) {
        incident.alertError = safeLocalError(alertError);
      }
    }
    incident.updatedAt = new Date().toISOString();
    await deps.writeIncident(input.config.dataDir, incident);
    await deps.appendRunLog(input.config.dataDir, {
      status: "failed",
      date,
      generatedAt: now.toISOString(),
      aiMode: input.config.ai.mode,
      model: input.config.ai.mode === "openai" ? input.config.ai.model : undefined,
      apiBaseUrl: input.config.ai.mode === "openai" ? input.config.ai.baseUrl : undefined,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      sourceItemCount: incident.sourceHealth?.itemCount ?? 0,
      sourceCount: incident.sourceHealth?.succeeded ?? 0,
      candidateCount: 0,
      selectedItemCount: 0,
      stage: incident.stage,
      errorCode: incident.code,
      errorMessage: incident.message,
      alertSent: incident.alertSent,
      sourceHealth: incident.sourceHealth,
    });
    throw operational;
  }
}

async function maybeSendSourceWarning(input: {
  config: RuntimeConfig;
  target: LarkTarget;
  date: string;
  now: Date;
  health: SourceHealth;
  sendCard: typeof sendLarkCard;
  writeIncident: typeof writeDailyIncident;
}): Promise<boolean> {
  if (!input.config.alerts.enabled || !input.config.alerts.alertOnPartialSourceFailure) return false;
  const failureRatio = input.health.configured > 0
    ? input.health.failed / input.health.configured
    : 1;
  const degraded = input.health.succeeded < input.config.alerts.minHealthySources
    || failureRatio > input.config.alerts.maxSourceFailureRatio;
  if (!degraded) return false;

  const warning = new RadarOperationalError(
    "SOURCE_HEALTH_DEGRADED",
    "collect",
    `本次仅有 ${input.health.succeeded}/${input.health.configured} 个信源正常`,
    "今日资讯已经正常推送。直接回复我“检查信息源”，我会列出仍未恢复的来源。",
    true,
    { sourceHealth: input.health },
  );
  const incident = createIncident({ error: warning, date: input.date, now: input.now, severity: "warning" });
  try {
    await input.sendCard({
      ...input.target,
      card: renderIncidentLarkCard(incident),
      idempotencyKey: `daily-info-radar-warning-${incident.id}`,
    });
    incident.alertSent = true;
  } catch (error) {
    incident.alertError = safeLocalError(error);
  }
  incident.updatedAt = new Date().toISOString();
  await input.writeIncident(input.config.dataDir, incident);
  return incident.alertSent;
}

function safeLocalError(error: unknown): string {
  const value = error instanceof Error ? error.message : "alert delivery failed";
  return value
    .replace(/(authorization|api[-_ ]?key|token|secret)=?[^\s,;]*/giu, "$1=[redacted]")
    .slice(0, 240);
}

export function latestIncidentSummary(incident: DailyIncident | undefined): string {
  if (!incident) return "目前没有已记录的故障。";
  return `${incident.message}（${incident.status === "resolved" ? "已恢复" : "待处理"}）`;
}
