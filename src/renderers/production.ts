import type { AnalyzedArticle, DailyBrief } from "../types.ts";
import { scoreForProduction } from "../cognitive.ts";

const DEEP_READ_LIMIT = 3;
const SIGNAL_LIMIT = 8;
const TOPIC_LIMIT = 5;

export function renderCognitiveProductionMarkdown(brief: DailyBrief): string {
  const items = [...brief.items].sort((a, b) => scoreForProduction(b) - scoreForProduction(a));
  const deepReads = items.filter((item) => item.cognitiveSignal?.priority === "精读").slice(0, DEEP_READ_LIMIT);
  const signals = items
    .filter((item) => (item.cognitiveSignal?.score ?? item.valueScore) >= 4)
    .slice(0, SIGNAL_LIMIT);
  const topics = items
    .filter((item) => item.useTags.includes("可做选题") || item.cognitiveSignal?.tags.includes("创作素材"))
    .slice(0, TOPIC_LIMIT);
  const cardSeed = deepReads[0] ?? signals[0] ?? items[0];

  const lines: string[] = [];
  lines.push(`# 认知生产线 - ${brief.date}`);
  lines.push("");
  lines.push(`生成时间：${brief.generatedAt}`);
  lines.push("");
  lines.push("## 今日处理顺序");
  lines.push("");
  lines.push("1. 先从「今日精读入口」里选 1 条真正精读。");
  lines.push("2. 精读后只回答一个问题：它改变了我什么判断？");
  lines.push("3. 把答案沉淀为认知增量卡片，再选择是否转成内容。");
  lines.push("");
  lines.push("## 今日精读入口");
  lines.push("");
  pushItems(lines, deepReads, renderDeepReadItem, "今天没有达到精读门槛的条目。");
  lines.push("");
  lines.push("## 认知增量候选");
  lines.push("");
  pushItems(lines, signals, renderSignalItem, "今天没有高分认知增量候选。");
  lines.push("");
  lines.push("## 可转化选题");
  lines.push("");
  pushItems(lines, topics, renderTopicItem, "今天没有明显可转化选题。");
  lines.push("");
  lines.push("## 待读清单");
  lines.push("");
  for (const item of items) {
    lines.push(`- [ ] [${item.title}](${item.canonicalUrl})`);
    lines.push(`  - 优先级：${item.cognitiveSignal?.priority ?? "追踪"} / ${item.cognitiveSignal?.score ?? item.valueScore}/5`);
    lines.push(`  - 来源：${item.sourceName}`);
    lines.push(`  - 推荐理由：${item.recommendationReason}`);
  }
  lines.push("");
  lines.push("## 认知增量卡片草稿");
  lines.push("");
  if (cardSeed) {
    pushCardDraft(lines, cardSeed);
  } else {
    lines.push("暂无可生成卡片的条目。");
  }
  lines.push("");
  lines.push("## 周复盘素材");
  lines.push("");
  lines.push("- 今日高分认知候选数：" + signals.length);
  lines.push("- 今日精读候选数：" + deepReads.length);
  lines.push("- 今日可做选题数：" + topics.length);
  lines.push("- 需要观察：哪些信源连续提供高分认知候选，哪些只是制造噪音。");
  lines.push("");
  return lines.join("\n");
}

function pushItems(
  lines: string[],
  items: AnalyzedArticle[],
  renderer: (item: AnalyzedArticle, index: number) => string[],
  emptyText: string,
): void {
  if (items.length === 0) {
    lines.push(emptyText);
    return;
  }
  items.forEach((item, index) => {
    lines.push(...renderer(item, index + 1));
    lines.push("");
  });
}

function renderDeepReadItem(item: AnalyzedArticle, index: number): string[] {
  return [
    `### ${index}. [${item.title}](${item.canonicalUrl})`,
    "",
    `- 来源：${item.sourceName}`,
    `- 认知分：${item.cognitiveSignal?.score ?? item.valueScore}/5`,
    `- 认知标签：${item.cognitiveSignal?.tags.join(" / ") ?? "未标注"}`,
    `- 为什么先读：${item.recommendationReason}`,
    `- 增量假设：${item.cognitiveSignal?.hypothesis ?? "待精读后判断"}`,
    `- 内容角度：${item.cognitiveSignal?.contentAngle ?? "待精读后判断"}`,
  ];
}

function renderSignalItem(item: AnalyzedArticle, index: number): string[] {
  return [
    `- **${index}. [${item.title}](${item.canonicalUrl})**`,
    `  - 优先级：${item.cognitiveSignal?.priority ?? "追踪"} / ${item.cognitiveSignal?.score ?? item.valueScore}/5`,
    `  - 增量假设：${item.cognitiveSignal?.hypothesis ?? item.recommendationReason}`,
  ];
}

function renderTopicItem(item: AnalyzedArticle, index: number): string[] {
  return [
    `- **${index}. ${item.cognitiveSignal?.contentAngle ?? item.title}**`,
    `  - 原文：[${item.title}](${item.canonicalUrl})`,
    `  - 可用栏目：今日认知增量 / 这篇值得精读 / AI 信息输入系统搭建日志`,
  ];
}

function pushCardDraft(lines: string[], item: AnalyzedArticle): void {
  lines.push(`### 原始信息`);
  lines.push("");
  lines.push(`- 标题：[${item.title}](${item.canonicalUrl})`);
  lines.push(`- 来源：${item.sourceName}`);
  lines.push(`- 类型：${item.domain} / ${item.contentType}`);
  lines.push("");
  lines.push("### 它为什么值得读");
  lines.push("");
  lines.push(item.recommendationReason);
  lines.push("");
  lines.push("### 它可能改变什么判断");
  lines.push("");
  lines.push(item.cognitiveSignal?.hypothesis ?? "待精读后填写。");
  lines.push("");
  lines.push("### 精读后我的判断变化");
  lines.push("");
  lines.push("- 旧判断：");
  lines.push("- 新判断：");
  lines.push("- 变化原因：");
  lines.push("");
  lines.push("### 可迁移场景");
  lines.push("");
  lines.push("- 工作：");
  lines.push("- 创作：");
  lines.push("- 产品：");
  lines.push("- 创业：");
  lines.push("");
  lines.push("### 可转化内容");
  lines.push("");
  lines.push(`- 内容角度：${item.cognitiveSignal?.contentAngle ?? "待精读后填写。"}`);
  lines.push("- 短内容：");
  lines.push("- 长文：");
  lines.push("- 下一步行动：");
}
