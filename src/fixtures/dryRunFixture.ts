import type { MarketSnapshot, SourceItem } from "../types.ts";
import { MARKET_WATCHLIST } from "../collectors/market.ts";

export function createDryRunFixture(): {
  sourceItems: SourceItem[];
  marketSnapshots: MarketSnapshot[];
} {
  return {
    marketSnapshots: MARKET_WATCHLIST.map((asset, index) => ({
      ...asset,
      changePercent: Number(((index % 2 === 0 ? 1 : -1) * (0.12 + index / 100)).toFixed(2)),
      status: "ok",
    })),
    sourceItems: [
      item("openai", "OpenAI Blog", "ai", "OpenAI releases a new multimodal model", "https://openai.com/blog/new-model?utm_source=rss", "Official model release with API and product implications."),
      item("deepmind", "DeepMind Blog", "ai", "DeepMind shares new agent research results", "https://deepmind.google/discover/blog/agent-research", "Research update with benchmarks and deployment notes."),
      item("huggingface", "Hugging Face Blog", "ai", "Open model community standardizes evaluation harness", "https://huggingface.co/blog/eval-harness", "Engineering-focused deep dive on model evaluation."),
      item("arxiv", "arXiv", "ai", "Efficient long-context inference for reasoning models", "https://arxiv.org/abs/2606.00001", "Paper on reducing serving costs for long-context models."),
      item("latent-space", "Latent Space", "ai", "What developers learned from building AI agents in production", "https://www.latent.space/p/agents-production", "Long-form practitioner analysis."),
      item("github", "GitHub Trending", "tech", "A database migration tool becomes the top TypeScript repository", "https://github.com/trending/typescript?since=daily", "Developer tooling trend worth tracking."),
      item("hn", "Hacker News", "tech", "Show HN: Local-first notebook for technical teams", "https://news.ycombinator.com/item?id=40000001", "Community discussion with implementation details."),
      item("ars", "Ars Technica", "tech", "Major browser vendors agree on new privacy sandbox API", "https://arstechnica.com/information-technology/privacy-api", "Platform-level change for web developers."),
      item("techcrunch", "TechCrunch", "tech", "AI infrastructure startup raises funding after enterprise traction", "https://techcrunch.com/2026/06/13/ai-infra-startup", "Funding signal in AI infrastructure."),
      item("v2ex", "V2EX", "tech", "开发者讨论本地优先工具链的新实践", "https://www.v2ex.com/t/1000001", "中文社区对工具链变化的实践反馈。"),
      item("marketwatch", "MarketWatch", "market", "Mega-cap tech stocks lift Nasdaq 100 before the open", "https://www.marketwatch.com/story/nasdaq-100-tech-stocks", "Market signal for US technology stocks."),
      item("wsj", "WSJ Markets", "market", "Chip stocks rally as AI server demand stays resilient", "https://www.wsj.com/markets/chip-stocks-ai-server-demand", "Sector-level market movement linked to AI capex."),
      item("xueqiu", "雪球", "market", "A 股算力板块午后走强", "https://xueqiu.com/status/1000002", "中国市场科技方向情绪信号。"),
      item("duplicate", "Newsletter", "ai", "OpenAI releases a new multimodal model!", "https://openai.com/blog/new-model#comments", "Duplicate discussion of the official release."),
      item("blocked-video", "Video Feed", "ai", "Podcast: AI founders discuss the week", "https://video.example.com/podcast-ai", "Audio show that should be filtered."),
    ],
  };
}

function item(
  sourceId: string,
  sourceName: string,
  domainHint: SourceItem["domainHint"],
  title: string,
  url: string,
  summary: string,
): SourceItem {
  return {
    sourceId,
    sourceName,
    domainHint,
    title,
    url,
    summary,
    publishedAt: "2026-06-13T00:00:00.000Z",
  };
}
