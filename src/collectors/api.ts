import { createHash } from "node:crypto";

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

  if (source.id === "zhihu-hot") {
    const payload = await fetchJson(source.url, zhihuHeaders());
    return parseZhihuHotList(payload, source).slice(0, API_LIMIT);
  }

  if (source.id === "wallstreetcn-news") {
    const payload = await fetchJson(source.url);
    return parseWallstreetcnNews(payload, source).slice(0, API_LIMIT);
  }

  if (source.id === "cls-telegraph") {
    const payload = await fetchJson(buildClsTelegraphUrl(source.url), {
      referer: "https://www.cls.cn/telegraph",
    });
    return parseClsTelegraph(payload, source).slice(0, API_LIMIT);
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

export function parseZhihuHotList(
  payload: unknown,
  source: SourceConfig,
  now = new Date(),
): SourceItem[] {
  const records = Array.isArray((payload as { data?: unknown[] })?.data)
    ? (payload as { data: unknown[] }).data
    : [];

  return records.flatMap((entry) => {
    const record = entry as {
      target?: {
        title_area?: { text?: string };
        excerpt_area?: { text?: string };
        metrics_area?: { text?: string };
        link?: { url?: string };
      };
    };
    const title = record.target?.title_area?.text;
    const url = record.target?.link?.url;
    if (!title || !url) return [];
    const summary = [record.target?.excerpt_area?.text, record.target?.metrics_area?.text]
      .filter(Boolean)
      .join(" | ");
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url,
        summary,
        publishedAt: now.toISOString(),
      },
    ];
  });
}

export function parseWallstreetcnNews(payload: unknown, source: SourceConfig): SourceItem[] {
  const records = Array.isArray(
    (payload as { data?: { items?: unknown[] } })?.data?.items,
  )
    ? (payload as { data: { items: unknown[] } }).data.items
    : [];

  return records.flatMap((entry) => {
    const wrapper = entry as {
      resource_type?: string;
      resource?: {
        id?: number | string;
        title?: string;
        content_short?: string;
        content_text?: string;
        display_time?: number;
        type?: string;
        uri?: string;
      };
    };
    const resource = wrapper.resource;
    if (!resource) return [];
    if (wrapper.resource_type === "theme" || wrapper.resource_type === "ad") return [];
    if (resource.type === "live" || !resource.uri) return [];
    const title = resource.title ?? resource.content_short ?? resource.content_text;
    if (!title) return [];
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url: normalizeWallstreetcnUrl(resource.uri),
        summary: resource.content_short ?? resource.content_text,
        publishedAt: secondsToIso(resource.display_time),
      },
    ];
  });
}

export function parseClsTelegraph(payload: unknown, source: SourceConfig): SourceItem[] {
  const records = Array.isArray(
    (payload as { data?: { roll_data?: unknown[] } })?.data?.roll_data,
  )
    ? (payload as { data: { roll_data: unknown[] } }).data.roll_data
    : [];

  return records.flatMap((entry) => {
    const record = entry as {
      id?: number | string;
      title?: string;
      brief?: string;
      shareurl?: string;
      ctime?: number;
      is_ad?: number;
    };
    if (record.is_ad) return [];
    const title = record.title ?? record.brief;
    if (!record.id || !title) return [];
    return [
      {
        sourceId: source.id,
        sourceName: source.name,
        sourceWeight: source.weight,
        sourceSubcategory: source.subcategory,
        domainHint: source.domainHint,
        language: source.lang,
        title,
        url: record.shareurl ?? `https://www.cls.cn/detail/${record.id}`,
        summary: record.brief,
        publishedAt: secondsToIso(record.ctime),
      },
    ];
  });
}

export function buildClsTelegraphUrl(baseUrl: string, now = new Date()): string {
  const params = new URLSearchParams({
    appName: "CailianpressWeb",
    last_time: Math.floor(now.getTime() / 1000).toString(),
    os: "web",
    refresh_type: "1",
    rn: API_LIMIT.toString(),
    sv: "7.7.5",
  });
  params.sort();
  const sign = md5(sha1(params.toString()));
  params.append("sign", sign);
  return `${baseUrl}?${params.toString()}`;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": "daily-info-radar/0.1", ...headers },
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

function normalizeWallstreetcnUrl(value: string): string {
  if (/^https?:\/\//iu.test(value)) return value;
  return `https://wallstreetcn.com${value.startsWith("/") ? "" : "/"}${value}`;
}

function zhihuHeaders(): Record<string, string> {
  return {
    referer: "https://www.zhihu.com/hot",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 daily-info-radar/0.1",
  };
}

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}
