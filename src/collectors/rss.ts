import type { SourceConfig, SourceItem } from "../types.ts";

export async function collectRssSource(source: SourceConfig): Promise<SourceItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "daily-info-radar/0.1",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }
  return parseRss(await response.text(), source);
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
