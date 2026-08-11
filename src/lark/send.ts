import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export type LarkTarget =
  | { chatId: string; userId?: never }
  | { chatId?: never; userId: string };

export type LarkSendOptions = LarkTarget & {
  markdown: string;
  idempotencyKey: string;
};

export type LarkCardSendOptions = LarkTarget & {
  card: unknown;
  idempotencyKey: string;
};

export type LarkSendArgsOptions =
  | LarkSendOptions
  | LarkCardSendOptions;

export function buildLarkSendArgs(options: LarkSendOptions): string[] {
  return buildLarkMessageArgs(options);
}

export function buildLarkMessageArgs(options: LarkSendArgsOptions): string[] {
  const target = "chatId" in options
    ? ["--chat-id", options.chatId]
    : ["--user-id", options.userId];
  const content = "card" in options
    ? ["--msg-type", "interactive", "--content", JSON.stringify(options.card)]
    : ["--markdown", options.markdown];

  return [
    "im",
    "+messages-send",
    "--as",
    "bot",
    ...target,
    ...content,
    "--idempotency-key",
    normalizeIdempotencyKey(options.idempotencyKey),
  ];
}

export function normalizeIdempotencyKey(value: string): string {
  if (value.length <= 50) return value;
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${value.slice(0, 33)}-${digest}`;
}

export async function sendLarkMarkdown(options: LarkSendOptions): Promise<{
  stdout: string;
  stderr: string;
}> {
  const args = buildLarkSendArgs(options);
  return runCommand("lark-cli", args);
}

export async function sendLarkCard(options: LarkCardSendOptions): Promise<{
  stdout: string;
  stderr: string;
}> {
  const args = buildLarkMessageArgs(options);
  return runCommand("lark-cli", args);
}

export function buildLarkCliEnv(
  env: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  return {
    ...env,
    LARK_CLI_NO_PROXY: "1",
  };
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: buildLarkCliEnv(),
    });
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
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
      }
    });
  });
}
