import type { SourceConfig } from "./types.ts";

export type SourceCheckResult = {
  id: string;
  name: string;
  kind: SourceConfig["kind"];
  url: string;
  ok: boolean;
  status?: number;
  itemCount?: number;
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

export async function checkSources(sources: SourceConfig[]): Promise<SourceCheckResult[]> {
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await fetch(source.url, {
          headers: { "user-agent": "daily-info-radar/0.1" },
          signal: AbortSignal.timeout(8000),
        });
        return {
          id: source.id,
          name: source.name,
          kind: source.kind,
          url: source.url,
          ok: response.ok,
          status: response.status,
        };
      } catch (error) {
        return {
          id: source.id,
          name: source.name,
          kind: source.kind,
          url: source.url,
          ok: false,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    }),
  );
  return results;
}
