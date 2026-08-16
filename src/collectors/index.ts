import type { MarketSnapshot, SourceConfig, SourceHealth, SourceItem } from "../types.ts";
import { collectApiSource } from "./api.ts";
import { collectMarketSnapshots } from "./market.ts";
import { collectRssSource } from "./rss.ts";
import { collectScrapeSource } from "./scrape.ts";

export async function collectSourceItems(sources: SourceConfig[]): Promise<SourceItem[]> {
  return (await collectSourceItemsWithHealth(sources)).items;
}

export async function collectSourceItemsWithHealth(sources: SourceConfig[]): Promise<{
  items: SourceItem[];
  health: SourceHealth;
}> {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      if (source.kind === "rss") return collectRssSource(source);
      if (source.kind === "api") return collectApiSource(source);
      if (source.kind === "scrape") return collectScrapeSource(source);
      return [];
    }),
  );
  const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const failures = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const source = sources[index];
    if (!source) return [];
    return [{
      sourceId: source.id,
      sourceName: source.name,
      reason: safeFailureReason(result.reason),
    }];
  });
  return {
    items,
    health: {
      configured: sources.length,
      succeeded: sources.length - failures.length,
      failed: failures.length,
      itemCount: items.length,
      failures,
    },
  };
}

export async function collectDailyInputs(sources: SourceConfig[]): Promise<{
  sourceItems: SourceItem[];
  marketSnapshots: MarketSnapshot[];
  sourceHealth: SourceHealth;
}> {
  const [collection, marketSnapshots] = await Promise.all([
    collectSourceItemsWithHealth(sources),
    collectMarketSnapshots(),
  ]);

  return {
    sourceItems: collection.items,
    marketSnapshots,
    sourceHealth: collection.health,
  };
}

function safeFailureReason(reason: unknown): string {
  const value = reason instanceof Error ? reason.message : "source request failed";
  return value
    .replace(/(authorization|api[-_ ]?key|token|secret)=?[^\s,;]*/giu, "$1=[redacted]")
    .slice(0, 240);
}
