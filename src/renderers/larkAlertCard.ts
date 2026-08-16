import type { DailyIncident } from "../types.ts";
import type { LarkCard } from "./larkCard.ts";

const STAGE_LABELS: Record<DailyIncident["stage"], string> = {
  collect: "资讯采集",
  analyze: "AI 分析",
  render: "日报生成",
  deliver: "飞书发送",
  unknown: "运行流程",
};

export function renderIncidentLarkCard(incident: DailyIncident): LarkCard {
  const sourceLine = incident.sourceHealth
    ? `\n**信源状态**：${incident.sourceHealth.succeeded}/${incident.sourceHealth.configured} 可用`
    : "";
  return {
    config: { wide_screen_mode: true },
    header: {
      template: incident.severity === "warning" ? "yellow" : "red",
      title: { tag: "plain_text", content: incident.title },
    },
    elements: [
      markdownElement([
        `**时间**：${formatLocalTime(incident.createdAt)}`,
        `**失败阶段**：${STAGE_LABELS[incident.stage]}`,
        `**原因**：${escapeLarkMd(incident.message)}${sourceLine}`,
      ].join("\n")),
      { tag: "hr" },
      markdownElement(`**建议**：${escapeLarkMd(incident.suggestion)}`),
      markdownElement("请勿在飞书中发送 API Key、App Secret 或其他密钥。"),
    ],
  };
}

export function renderIncidentHelp(incident: DailyIncident | undefined): string {
  if (!incident) {
    return "目前没有已记录的故障。你可以回复“状态”查看最近一次日报运行情况。";
  }
  const state = incident.status === "resolved" ? "已恢复" : "待处理";
  return [
    `最近故障：${incident.message}`,
    `当前状态：${state}`,
    `处理建议：${incident.suggestion}`,
    "安全提醒：不要在飞书中发送 API Key、App Secret 或完整 .env 内容。",
  ].join("\n");
}

function markdownElement(content: string): Record<string, unknown> {
  return { tag: "div", text: { tag: "lark_md", content } };
}

function formatLocalTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date)
    : value;
}

function escapeLarkMd(value: string): string {
  return value.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
