import type { AnalyzedArticle, DailyBrief, Domain, MarketSnapshot } from "../types.ts";

const DOMAIN_LABELS: Record<Domain, string> = {
  ai: "AI",
  tech: "科技",
  market: "股市",
};

export function renderDailyBriefMarkdown(brief: DailyBrief): string {
  const lines: string[] = [];

  lines.push(`# 每日信息雷达 - ${brief.date}`);
  lines.push("");
  lines.push(`生成时间：${brief.generatedAt}`);
  lines.push("");
  lines.push("## 市场快照");
  lines.push("");

  for (const snapshot of brief.marketSnapshot) {
    lines.push(`- ${renderMarketSnapshot(snapshot)}`);
  }

  lines.push("");
  lines.push("## 精选信息");
  lines.push("");

  brief.items.forEach((item, index) => {
    lines.push(renderArticle(item, index + 1));
    lines.push("");
  });

  lines.push("## 来源统计");
  lines.push("");
  for (const [source, count] of Object.entries(brief.sourceStats).sort()) {
    lines.push(`- ${source}: ${count}`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderMarketSnapshot(snapshot: MarketSnapshot): string {
  if (snapshot.status !== "ok" || typeof snapshot.changePercent !== "number") {
    return `${snapshot.name}: 数据暂不可用${snapshot.note ? `（${snapshot.note}）` : ""}`;
  }
  const sign = snapshot.changePercent >= 0 ? "+" : "";
  return `${snapshot.name}: ${sign}${snapshot.changePercent.toFixed(2)}%`;
}

function renderArticle(item: AnalyzedArticle, index: number): string {
  const tags = item.useTags.length > 0 ? item.useTags.join(" / ") : "持续关注";
  const lines = [
    `### [${index}] [${item.title}](${item.canonicalUrl})`,
    "",
    `- 领域：${DOMAIN_LABELS[item.domain]}`,
    `- 类型：${item.contentType}`,
    `- 来源：${item.sourceName}`,
    `- 时间：${item.publishedAt ?? "未知"}`,
    `- 标签：${tags}`,
    `- 推荐理由：${item.recommendationReason}`,
  ];
  if (item.cognitiveSignal) {
    lines.push(`- 认知优先级：${item.cognitiveSignal.priority} / ${item.cognitiveSignal.score}/5`);
    lines.push(`- 认知标签：${item.cognitiveSignal.tags.join(" / ")}`);
    lines.push(`- 增量假设：${item.cognitiveSignal.hypothesis}`);
    lines.push(`- 内容角度：${item.cognitiveSignal.contentAngle}`);
  }
  return lines.join("\n");
}
