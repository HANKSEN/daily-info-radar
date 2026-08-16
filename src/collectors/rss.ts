import type { SourceConfig, SourceItem } from "../types.ts";
import { fetchText, type FetchTextOptions, type FetchTextResult } from "../http.ts";

const RSS_TIMEOUT_MS = 8000;
type RssFallbackSource = {
  url: string;
  sourceId?: string;
  sourceName?: string;
};

const RSS_FALLBACK_URLS: Record<string, RssFallbackSource[]> = {
  "huggingface-blog": [
    {
      url: "https://www.bestblogs.dev/en/feeds/rss?category=ai&minScore=90",
      sourceId: "bestblogs-ai-high-score",
      sourceName: "BestBlogs AI 高分内容",
    },
  ],
};

export type RssTextFetcher = (
  url: string,
  options?: FetchTextOptions,
) => Promise<FetchTextResult>;

export async function collectRssSource(
  source: SourceConfig,
  fetcher: RssTextFetcher = fetchText,
): Promise<SourceItem[]> {
  const targets = getRssSourceTargets(source);
  const errors: unknown[] = [];
  for (const target of targets) {
    try {
      const response = await fetcher(target.url, {
        headers: {
          "user-agent": "daily-info-radar/0.1",
        },
        timeoutMs: RSS_TIMEOUT_MS,
        curlFallback: true,
      });
      return parseRss(response.text, applyFallbackSource(source, target));
    } catch (error) {
      errors.push(error);
    }
  }
  throw new Error(`Failed to fetch ${source.name} from all RSS URLs`, { cause: errors });
}

export function getRssSourceUrls(source: Pick<SourceConfig, "id" | "url">): string[] {
  return getRssSourceTargets(source).map((target) => target.url);
}

function getRssSourceTargets(source: Pick<SourceConfig, "id" | "url">): RssFallbackSource[] {
  return [{ url: source.url }, ...(RSS_FALLBACK_URLS[source.id] ?? [])];
}

function applyFallbackSource(source: SourceConfig, target: RssFallbackSource): SourceConfig {
  return {
    ...source,
    id: target.sourceId ?? source.id,
    name: target.sourceName ?? source.name,
    url: target.url,
  };
}

export function parseRss(xml: string, source: SourceConfig): SourceItem[] {
  const blocks = extractBlocks(xml, "item");
  const entries = blocks.length > 0 ? blocks : extractBlocks(xml, "entry");

  return entries
    .map((block) => {
      const title = decodeXml(extractTag(block, "title") ?? "");
      const link = decodeXml(extractTag(block, "link") ?? extractAtomLink(block) ?? "");
      if (!title || !link) return undefined;

      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url: link,
        summary: decodeXml(extractTag(block, "description") ?? extractTag(block, "summary") ?? ""),
        publishedAt:
          normalizeDate(extractTag(block, "pubDate")) ??
          normalizeDate(extractTag(block, "published")) ??
          normalizeDate(extractTag(block, "updated")),
      } satisfies SourceItem;
    })
    .filter((item): item is SourceItem => Boolean(item));
}

function extractBlocks(xml: string, tag: string): string[] {
  return Array.from(xml.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"))).map(
    ([block]) => block,
  );
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function extractAtomLink(block: string): string | undefined {
  const match = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1];
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
