export type ReadinessInput = {
  env: Record<string, string | undefined>;
  sourceCheck: {
    checked: number;
    okCount: number;
  };
};

export type ReadinessResult = {
  ready: boolean;
  missingEnv: string[];
  issues: string[];
};

const REQUIRED_ENV = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];

export function validateRuntimeReadiness(input: ReadinessInput): ReadinessResult {
  const aiMode = input.env.RADAR_AI_MODE === "heuristic" ? "heuristic" : "openai";
  const missingEnv = aiMode === "heuristic" ? [] : REQUIRED_ENV.filter((key) => !input.env[key]);
  const issues: string[] = [];

  if (missingEnv.length > 0) {
    issues.push(`Missing required environment variables: ${missingEnv.join(", ")}`);
  }

  if (input.sourceCheck.checked === 0) {
    issues.push("No sources are configured.");
  } else if (input.sourceCheck.okCount === 0) {
    issues.push("No sources are currently reachable.");
  }

  return {
    ready: missingEnv.length === 0 && issues.length === 0,
    missingEnv,
    issues,
  };
}
