import type { AnalyzedArticle, DailyBrief, Domain, MarketSnapshot } from "../types.ts";

const DOMAIN_LABELS: Record<Domain, string> = {
  ai: "AI",
  tech: "科技",
  market: "市场",
};

const CARD_MARKET_LIMIT = 8;

export type LarkCard = {
  config: { wide_screen_mode: boolean };
  header: {
    template: string;
    title: { tag: "plain_text"; content: string };
  };
  elements: Array<Record<string, unknown>>;
};

export function renderDailyBriefLarkCard(brief: DailyBrief): LarkCard {
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: `每日信息雷达 · ${brief.date}`,
      },
    },
    elements: [
      markdownElement(renderOverview(brief)),
      markdownElement(renderMarketBlock(brief.marketSnapshot)),
      { tag: "hr" },
      ...brief.items.map((item, index) => markdownElement(renderArticleBlock(item, index + 1))),
      { tag: "hr" },
      markdownElement(renderFooter(brief)),
    ],
  };
}

function renderOverview(brief: DailyBrief): string {
  const usage = brief.modelUsage;
  const tokenLine = usage
    ? `\nToken: ${usage.totalTokens ?? 0}（prompt ${usage.promptTokens ?? 0} / completion ${usage.completionTokens ?? 0}）`
    : "";
  return `**生成时间**: ${brief.generatedAt}\n**精选条目**: ${brief.items.length}${tokenLine}`;
}

function renderMarketBlock(snapshots: MarketSnapshot[]): string {
  const visible = snapshots.slice(0, CARD_MARKET_LIMIT).map(renderMarketSnapshot).join(" · ");
  const suffix = snapshots.length > CARD_MARKET_LIMIT ? `\n其余 ${snapshots.length - CARD_MARKET_LIMIT} 项见本地 Markdown 日报。` : "";
  return `**市场快照**\n${visible || "暂无市场数据"}${suffix}`;
}

function renderMarketSnapshot(snapshot: MarketSnapshot): string {
  if (snapshot.status !== "ok" || typeof snapshot.changePercent !== "number") {
    return `${escapeLarkMd(snapshot.name)}: 暂无`;
  }
  const sign = snapshot.changePercent >= 0 ? "+" : "";
  return `${escapeLarkMd(snapshot.name)}: ${sign}${snapshot.changePercent.toFixed(2)}%`;
}

function renderArticleBlock(item: AnalyzedArticle, index: number): string {
  const tags = item.useTags.length > 0 ? item.useTags.join(" / ") : "持续关注";
  return [
    `**${index}. [${escapeLarkMd(item.title)}](${item.canonicalUrl})**`,
    `${DOMAIN_LABELS[item.domain]} · ${item.contentType} · ${escapeLarkMd(item.sourceName)}`,
    `标签: ${escapeLarkMd(tags)}`,
    `推荐: ${escapeLarkMd(item.recommendationReason)}`,
  ].join("\n");
}

function renderFooter(brief: DailyBrief): string {
  const sourceCount = Object.keys(brief.sourceStats).length;
  return `来源覆盖: ${sourceCount} 个源 · 本地归档: ${brief.date}`;
}

function markdownElement(content: string): Record<string, unknown> {
  return {
    tag: "div",
    text: {
      tag: "lark_md",
      content,
    },
  };
}

function escapeLarkMd(value: string): string {
  return value.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
