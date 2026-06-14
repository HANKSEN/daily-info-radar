import type { MarketSnapshot, SourceConfig, SourceItem } from "../types.ts";
import { collectApiSource } from "./api.ts";
import { collectMarketSnapshots } from "./market.ts";
import { collectRssSource } from "./rss.ts";
import { collectScrapeSource } from "./scrape.ts";

export async function collectSourceItems(sources: SourceConfig[]): Promise<SourceItem[]> {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      if (source.kind === "rss") return collectRssSource(source);
      if (source.kind === "api") return collectApiSource(source);
      if (source.kind === "scrape") return collectScrapeSource(source);
      return [];
    }),
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function collectDailyInputs(sources: SourceConfig[]): Promise<{
  sourceItems: SourceItem[];
  marketSnapshots: MarketSnapshot[];
}> {
  const [sourceItems, marketSnapshots] = await Promise.all([
    collectSourceItems(sources),
    collectMarketSnapshots(),
  ]);

  return { sourceItems, marketSnapshots };
}
