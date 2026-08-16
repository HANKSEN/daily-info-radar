import type { AnalyzedArticle, DailyBrief, Domain, MarketSnapshot } from "../types.ts";
import { formatDateTimeInTimezone } from "../date.ts";

const DOMAIN_LABELS: Record<Domain, string> = {
  ai: "AI",
  tech: "科技",
  market: "市场",
};

const MARKET_GROUPS: Array<{
  region: NonNullable<MarketSnapshot["region"]>;
  label: string;
}> = [
  { region: "us", label: "美股" },
  { region: "cn", label: "沪深" },
  { region: "hk", label: "港股" },
  { region: "other", label: "其他" },
];

const LEGACY_HIDDEN_CARD_SYMBOLS = new Set([
  "NVDA",
  "MSFT",
  "AAPL",
  "GOOGL",
  "META",
  "TSLA",
  "BABA",
  "BIDU",
  "JD",
]);

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
      ...renderMarketElements(brief.marketSnapshot),
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
  return `**生成时间**: ${formatDateTimeInTimezone(brief.generatedAt)}\n**精选条目**: ${brief.items.length}${tokenLine}`;
}

function renderMarketElements(snapshots: MarketSnapshot[]): Array<Record<string, unknown>> {
  const visible = snapshots.filter((snapshot) =>
    snapshot.cardVisible ?? !LEGACY_HIDDEN_CARD_SYMBOLS.has(snapshot.symbol)
  );
  const groups = MARKET_GROUPS.map(({ region, label }) => {
    const items = visible.filter((snapshot) => marketRegion(snapshot) === region);
    if (items.length === 0) return undefined;
    return { region, content: renderMarketGroup(label, items) };
  }).filter((group): group is { region: NonNullable<MarketSnapshot["region"]>; content: string } => Boolean(group));
  const source = visible.find((snapshot) => snapshot.sourceName && snapshot.sourceUrl);
  const fetchedAt = latestTimestamp(visible.map((snapshot) => snapshot.fetchedAt));
  const metadata = [
    "**市场快照**",
    source
      ? `数据源：[${escapeLarkMd(source.sourceName ?? "行情来源")}](${source.sourceUrl})`
      : "数据源：历史数据未记录",
    `快照时间：${fetchedAt ? formatDateTimeInTimezone(fetchedAt) : "历史数据未记录"}（北京时间）`,
    "口径：最新有效交易价较上一有效交易日收盘",
  ].join("\n");
  if (groups.length === 0) return [markdownElement(`${metadata}\n暂无市场数据`)];

  const rows: Array<Record<string, unknown>> = [markdownElement(metadata)];
  for (let index = 0; index < groups.length; index += 2) {
    rows.push(columnSet(groups.slice(index, index + 2).map((group) => group.content)));
  }
  return rows;
}

function renderMarketGroup(label: string, snapshots: MarketSnapshot[]): string {
  const asOf = latestTimestamp(snapshots.map((snapshot) => snapshot.asOf));
  return [
    `**${label}**`,
    asOf ? `截至 ${formatDateTimeInTimezone(asOf)}` : "行情时间未记录",
    ...snapshots.map(renderMarketSnapshot),
  ].join("\n");
}

function renderMarketSnapshot(snapshot: MarketSnapshot): string {
  const name = snapshot.sourceUrl
    ? `[${escapeLarkMd(snapshot.name)}](${snapshot.sourceUrl})`
    : escapeLarkMd(snapshot.name);
  if (
    snapshot.status !== "ok" ||
    typeof snapshot.changePercent !== "number" ||
    !snapshot.sourceName ||
    !snapshot.asOf
  ) {
    return `${name}　暂无可核实数据`;
  }
  const sign = snapshot.changePercent >= 0 ? "+" : "";
  return `${name}　**${sign}${snapshot.changePercent.toFixed(2)}%**`;
}

function columnSet(contents: string[]): Record<string, unknown> {
  return {
    tag: "column_set",
    flex_mode: "none",
    columns: contents.map((content) => ({
      tag: "column",
      width: "weighted",
      weight: 1,
      elements: [markdownElement(content)],
    })),
  };
}

function latestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function marketRegion(snapshot: MarketSnapshot): NonNullable<MarketSnapshot["region"]> {
  if (snapshot.region) return snapshot.region;
  if (["^NDX", "QQQM", "^GSPC", "^DJI"].includes(snapshot.symbol) || snapshot.group === "tech_stock") {
    return "us";
  }
  if (["BABA", "BIDU", "JD"].includes(snapshot.symbol)) return "us";
  if (["000300.SS", "000001.SS", "399006.SZ"].includes(snapshot.symbol)) return "cn";
  if (snapshot.symbol === "^HSI" || snapshot.symbol.endsWith(".HK")) return "hk";
  return "other";
}

function renderArticleBlock(item: AnalyzedArticle, index: number): string {
  const tags = item.useTags.length > 0 ? item.useTags.join(" / ") : "持续关注";
  const cognitive = item.cognitiveSignal
    ? `认知: ${item.cognitiveSignal.priority} · ${item.cognitiveSignal.score}/5 · ${item.cognitiveSignal.tags.join(" / ")}`
    : undefined;
  return [
    `**${index}. [${escapeLarkMd(item.title)}](${item.canonicalUrl})**`,
    `${DOMAIN_LABELS[item.domain]} · ${item.contentType} · ${escapeLarkMd(item.sourceName)}`,
    `标签: ${escapeLarkMd(tags)}`,
    cognitive ? escapeLarkMd(cognitive) : undefined,
    `推荐: ${escapeLarkMd(item.recommendationReason)}`,
  ].filter(Boolean).join("\n");
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
