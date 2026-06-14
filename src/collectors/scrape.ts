import type { SourceConfig, SourceItem } from "../types.ts";

export async function collectScrapeSource(source: SourceConfig): Promise<SourceItem[]> {
  if (source.id !== "github-trending") return [];
  const response = await fetch(source.url, {
    headers: { "user-agent": "daily-info-radar/0.1" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Scrape request failed: ${response.status} ${source.url}`);
  return parseGitHubTrendingHtml(await response.text(), source);
}

export function parseGitHubTrendingHtml(
  html: string,
  source: SourceConfig,
  now = new Date(),
): SourceItem[] {
  const articles = Array.from(html.matchAll(/<article\b[\s\S]*?<\/article>/giu)).map(
    ([article]) => article,
  );

  return articles.flatMap((article) => {
    const href = attr(article.match(/<h2[\s\S]*?<a\b([\s\S]*?)>/iu)?.[1] ?? "", "href");
    const titleText = stripTags(article.match(/<h2[\s\S]*?<\/h2>/iu)?.[0] ?? "");
    const summary = stripTags(article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/iu)?.[1] ?? "");
    if (!href) return [];
    const repoPath = href.replace(/^\/+/u, "").replace(/\s+/gu, "");
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title: titleText.replace(/\s*\/\s*/u, "/") || repoPath,
        url: `https://github.com/${repoPath}`,
        summary,
        publishedAt: now.toISOString(),
      },
    ];
  });
}

function attr(value: string, name: string): string | undefined {
  const match = value.match(new RegExp(`${name}=["']([^"']+)["']`, "iu"));
  return match?.[1];
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
