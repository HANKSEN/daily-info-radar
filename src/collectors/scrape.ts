import type { SourceConfig, SourceItem } from "../types.ts";

const SCRAPE_TIMEOUT_MS = 8000;
const GITHUB_API_LIMIT = 30;

export async function collectScrapeSource(source: SourceConfig): Promise<SourceItem[]> {
  if (source.id === "llamaindex-blog") {
    const response = await fetch(source.url, {
      headers: { "user-agent": "daily-info-radar/0.1" },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Scrape request failed: ${response.status} ${source.url}`);
    return parseLlamaIndexBlogHtml(await response.text(), source);
  }

  if (source.id === "weibo-hot") {
    const response = await fetch(source.url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 daily-info-radar/0.1",
        referer: source.url,
      },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Scrape request failed: ${response.status} ${source.url}`);
    return parseWeiboHotHtml(await response.text(), source);
  }

  if (source.id !== "github-trending") return [];
  try {
    const response = await fetch(source.url, {
      headers: { "user-agent": "daily-info-radar/0.1" },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Scrape request failed: ${response.status} ${source.url}`);
    return parseGitHubTrendingHtml(await response.text(), source);
  } catch {
    return collectGitHubTrendingFallback(source);
  }
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

export function parseGitHubSearchRepositories(
  payload: unknown,
  source: SourceConfig,
  now = new Date(),
): SourceItem[] {
  const records = Array.isArray((payload as { items?: unknown[] })?.items)
    ? (payload as { items: unknown[] }).items
    : [];
  return records.flatMap((entry) => {
    const record = entry as {
      full_name?: string;
      html_url?: string;
      description?: string | null;
      stargazers_count?: number;
      language?: string | null;
      pushed_at?: string;
    };
    if (!record.full_name || !record.html_url) return [];
    const summaryParts = [
      record.description ?? undefined,
      typeof record.stargazers_count === "number" ? `stars: ${record.stargazers_count}` : undefined,
      record.language ? `language: ${record.language}` : undefined,
      "fallback: GitHub Search API",
    ].filter(Boolean);
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title: record.full_name,
        url: record.html_url,
        summary: summaryParts.join(" | "),
        publishedAt: normalizeIsoDate(record.pushed_at) ?? now.toISOString(),
      },
    ];
  });
}

export function parseLlamaIndexBlogHtml(
  html: string,
  source: SourceConfig,
): SourceItem[] {
  const items: SourceItem[] = [];
  const seen = new Set<string>();
  const links = html.matchAll(/<a\b([^>]*\bhref=["'][^"']*\/blog\/[^"']+["'][^>]*)>([\s\S]*?)<\/a>/giu);
  for (const match of links) {
    const href = attr(match[1], "href");
    const title = stripTags(match[2]);
    if (!href || !title || seen.has(href)) continue;
    seen.add(href);
    const nearby = html.slice(match.index ?? 0, (match.index ?? 0) + 800);
    const publishedAt = normalizeEnglishDate(
      nearby.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/u)?.[0],
    );
    items.push({
      sourceId: source.id,
      sourceName: source.name,
      sourceWeight: source.weight,
      sourceSubcategory: source.subcategory,
      domainHint: source.domainHint,
      language: source.lang,
      title,
      url: normalizeAbsoluteUrl(href, "https://www.llamaindex.ai"),
      publishedAt,
    });
  }
  return items;
}

export function parseWeiboHotHtml(
  html: string,
  source: SourceConfig,
  now = new Date(),
): SourceItem[] {
  const rows = Array.from(html.matchAll(/<tr\b[\s\S]*?<\/tr>/giu)).map(([row]) => row);
  return rows.flatMap((row) => {
    const linkMatch = row.match(/<td\b[^>]*class=["'][^"']*td-02[^"']*["'][\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>/iu);
    if (!linkMatch) return [];
    const href = attr(linkMatch[1], "href");
    const title = stripTags(linkMatch[2]);
    if (!href || !title || href.includes("javascript:void")) return [];
    const flag = stripTags(row.match(/<td\b[^>]*class=["'][^"']*td-03[^"']*["'][^>]*>([\s\S]*?)<\/td>/iu)?.[1] ?? "");
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url: normalizeWeiboUrl(href),
        summary: flag ? `微博热搜标记: ${flag}` : "微博热搜",
        publishedAt: now.toISOString(),
      },
    ];
  });
}

function attr(value: string, name: string): string | undefined {
  const match = value.match(new RegExp(`${name}=["']([^"']+)["']`, "iu"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
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

function normalizeWeiboUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  return `https://s.weibo.com${value.startsWith("/") ? "" : "/"}${value}`;
}

function normalizeAbsoluteUrl(value: string, baseUrl: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

function normalizeEnglishDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value} 00:00:00 UTC`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

async function collectGitHubTrendingFallback(source: SourceConfig): Promise<SourceItem[]> {
  const url = buildGitHubTrendingFallbackUrl();

  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "daily-info-radar/0.1",
    },
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GitHub fallback request failed: ${response.status}`);
  return parseGitHubSearchRepositories(await response.json(), source);
}

export function buildGitHubTrendingFallbackUrl(now = new Date()): string {
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", `pushed:>=${since} stars:>=50`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", GITHUB_API_LIMIT.toString());
  return url.toString();
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
