import { spawn } from "node:child_process";

export type FetchTextOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  curlFallback?: boolean;
};

export type FetchTextResult = {
  text: string;
  status: number;
  viaCurl: boolean;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_USER_AGENT = "daily-info-radar/0.1";

export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<FetchTextResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), status: response.status, viaCurl: false };
  } catch (fetchError) {
    if (!options.curlFallback) throw fetchError;
    const text = await runCurlText(url, {
      timeoutMs,
      userAgent: getUserAgent(options.headers),
    });
    return { text, status: 200, viaCurl: true };
  }
}

export async function checkUrl(
  url: string,
  options: FetchTextOptions = {},
): Promise<{ ok: boolean; status?: number; viaCurl?: boolean; error?: string }> {
  try {
    const result = await fetchText(url, options);
    return { ok: true, status: result.status, viaCurl: result.viaCurl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function getUserAgent(headers: Record<string, string> | undefined): string {
  return headers?.["user-agent"] ?? headers?.["User-Agent"] ?? DEFAULT_USER_AGENT;
}

function runCurlText(
  url: string,
  options: { timeoutMs: number; userAgent: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-fsSL",
      "--max-time",
      Math.ceil(options.timeoutMs / 1000).toString(),
      "-A",
      options.userAgent,
      url,
    ];
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`curl exited with ${code}: ${stderr || stdout}`));
    });
  });
}
