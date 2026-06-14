import type { ArticleCandidate } from "./types.ts";

const BLOCKED_PATTERNS = [
  /podcast/i,
  /youtube\.com/i,
  /youtu\.be/i,
  /video/i,
  /webinar/i,
  /直播/u,
  /播客/u,
  /视频/u,
];

export function prefilterCandidates(candidates: ArticleCandidate[]): ArticleCandidate[] {
  return candidates.filter((candidate) => {
    const text = `${candidate.title}\n${candidate.url}\n${candidate.summary ?? ""}`;
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return false;
    if (candidate.title.trim().length < 8) return false;
    return true;
  });
}
