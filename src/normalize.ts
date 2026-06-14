import type { ArticleCandidate, Language, SourceItem } from "./types.ts";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "spm",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export function canonicalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }

  const sortedParams = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  url.search = "";
  for (const [key, value] of sortedParams) {
    url.searchParams.append(key, value);
  }

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function normalizeSourceItem(item: SourceItem): ArticleCandidate {
  const canonicalUrl = canonicalizeUrl(item.url);
  const language = item.language ?? detectLanguage(`${item.title}\n${item.summary ?? ""}`);

  return {
    ...item,
    language,
    canonicalUrl,
    dedupeKey: normalizeTitleForDedupe(item.title),
    localSignals: {
      sourceWeight: item.sourceWeight ?? 1,
      freshnessScore: freshnessScore(item.publishedAt),
      duplicateCount: 1,
    },
  };
}

export function normalizeTitleForDedupe(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLanguage(text: string): Language {
  if (/[\u4e00-\u9fff]/u.test(text)) return "zh";
  if (/[a-z]/iu.test(text)) return "en";
  return "unknown";
}

function freshnessScore(publishedAt: string | undefined): number {
  if (!publishedAt) return 0.5;
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return 0.5;

  const ageHours = Math.max(0, (Date.now() - timestamp) / 1000 / 60 / 60);
  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.75;
  if (ageHours <= 168) return 0.5;
  return 0.25;
}
