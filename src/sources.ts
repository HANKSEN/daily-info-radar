import type { SourceConfig } from "./types.ts";
import { getRssSourceUrls } from "./collectors/rss.ts";
import { buildGitHubTrendingFallbackUrl } from "./collectors/scrape.ts";
import { checkUrl } from "./http.ts";

export type SourceCheckResult = {
  id: string;
  name: string;
  kind: SourceConfig["kind"];
  url: string;
  ok: boolean;
  status?: number;
  itemCount?: number;
  checkedUrl?: string;
  fallback?: boolean;
  viaCurl?: boolean;
  error?: string;
};

export function summarizeSources(sources: SourceConfig[]): Array<{
  id: string;
  name: string;
  kind: SourceConfig["kind"];
  domain: SourceConfig["domainHint"];
  subcategory?: string;
  lang?: SourceConfig["lang"];
  url: string;
  enabled: boolean;
  notes?: string;
}> {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    domain: source.domainHint,
    subcategory: source.subcategory,
    lang: source.lang,
    url: source.url,
    enabled: source.enabled !== false,
    notes: source.notes,
  }));
}

export async function checkSources(
  sources: SourceConfig[],
  options: { curlFallback?: boolean } = {},
): Promise<SourceCheckResult[]> {
  const curlFallback = options.curlFallback ?? true;
  const results = await Promise.all(
    sources.map(async (source) => {
      const urls = getSourceCheckUrls(source);
      let lastError: string | undefined;

      for (const [index, url] of urls.entries()) {
        const fallback = index > 0;
        const result = await checkUrl(url, {
          headers: { "user-agent": "daily-info-radar/0.1" },
          timeoutMs: 8000,
          curlFallback: curlFallback && source.kind === "rss",
        });
        if (result.ok) {
          return {
            id: source.id,
            name: source.name,
            kind: source.kind,
            url: source.url,
            ok: true,
            status: result.status,
            checkedUrl: url,
            fallback,
            viaCurl: result.viaCurl,
          };
        } else {
          lastError = result.error;
        }
      }

      return {
        id: source.id,
        name: source.name,
        kind: source.kind,
        url: source.url,
        ok: false,
        error: lastError,
      };
    }),
  );
  return results;
}

function getSourceCheckUrls(source: SourceConfig): string[] {
  if (source.kind === "rss") return getRssSourceUrls(source);
  if (source.id === "github-trending") return [source.url, buildGitHubTrendingFallbackUrl()];
  return [source.url];
}
