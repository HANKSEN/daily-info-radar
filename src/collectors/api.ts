import type { SourceConfig, SourceItem } from "../types.ts";

const API_LIMIT = 30;

export async function collectApiSource(source: SourceConfig): Promise<SourceItem[]> {
  if (source.id === "v2ex-hot") {
    const payload = await fetchJson(source.url);
    return parseV2exTopics(payload, source).slice(0, API_LIMIT);
  }

  if (source.id === "hacker-news-top") {
    const ids = await fetchJson(source.url) as number[];
    const itemUrlPrefix = source.url.replace(/topstories\.json.*$/u, "item");
    const results = await Promise.allSettled(
      ids.slice(0, API_LIMIT).map((id) => fetchJson(`${itemUrlPrefix}/${id}.json`)),
    );
    return results
      .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
      .map((item) => parseHackerNewsItem(item, source))
      .filter((item): item is SourceItem => Boolean(item));
  }

  if (source.id === "huggingface-daily-papers") {
    const payload = await fetchJson(source.url);
    return parseHuggingFaceDailyPapers(payload, source).slice(0, API_LIMIT);
  }

  return [];
}

export function parseV2exTopics(payload: unknown, source: SourceConfig): SourceItem[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((topic) => {
    const record = topic as {
      id?: number | string;
      title?: string;
      url?: string;
      content?: string;
      created?: number;
    };
    if (!record.title) return [];
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title: record.title,
        url: record.url ?? `https://www.v2ex.com/t/${record.id ?? ""}`,
        summary: record.content,
        publishedAt: secondsToIso(record.created),
      },
    ];
  });
}

export function parseHackerNewsItem(payload: unknown, source: SourceConfig): SourceItem | undefined {
  const item = payload as {
    id?: number;
    title?: string;
    url?: string;
    time?: number;
    score?: number;
    descendants?: number;
    type?: string;
  };
  if (!item.title || item.type === "job") return undefined;
  const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id ?? ""}`;
  const summaryParts = [
    typeof item.score === "number" ? `score: ${item.score}` : undefined,
    typeof item.descendants === "number" ? `comments: ${item.descendants}` : undefined,
  ].filter(Boolean);
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceWeight: source.weight,
    sourceSubcategory: source.subcategory,
    domainHint: source.domainHint,
    language: source.lang,
    title: item.title,
    url,
    summary: summaryParts.join(", "),
    publishedAt: secondsToIso(item.time),
  };
}

export function parseHuggingFaceDailyPapers(payload: unknown, source: SourceConfig): SourceItem[] {
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { papers?: unknown[] })?.papers)
      ? (payload as { papers: unknown[] }).papers
      : Array.isArray((payload as { dailyPapers?: unknown[] })?.dailyPapers)
        ? (payload as { dailyPapers: unknown[] }).dailyPapers
        : [];
  return records.flatMap((entry) => {
    const record = entry as {
      title?: string;
      publishedAt?: string;
      paper?: {
        id?: string;
        title?: string;
        summary?: string;
      };
    };
    const paperId = record.paper?.id;
    const title = record.title ?? record.paper?.title;
    if (!paperId || !title) return [];
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url: `https://huggingface.co/papers/${paperId}`,
        summary: record.paper?.summary,
        publishedAt: normalizeDate(record.publishedAt),
      },
    ];
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": "daily-info-radar/0.1" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status} ${url}`);
  return response.json();
}

function secondsToIso(value: number | undefined): string | undefined {
  if (typeof value !== "number") return undefined;
  return new Date(value * 1000).toISOString();
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
