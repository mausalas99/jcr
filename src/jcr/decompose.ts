import { query } from "@anthropic-ai/claude-agent-sdk";
import type { JcrDecomposerMetrics } from "./types.js";

export type Decomposition = {
  steps: string[];
  metrics: JcrDecomposerMetrics;
};

const instructions =
  'Break the request into the smallest ordered integration actions needed to satisfy it. Each step must describe exactly one action on exactly one external product or API. Preserve dependencies and concrete user values. Do not add implementation, authentication, discovery, or verification steps unless the user requested them. Respond with only a JSON object of the exact form {"steps": ["step one", "step two"]} and no other text.';

const normalizeSteps = (value: unknown): string[] => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("steps" in value) ||
    !Array.isArray(value.steps)
  ) {
    throw new Error("Decomposer returned an invalid steps object");
  }
  const steps = value.steps
    .filter((step): step is string => typeof step === "string")
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length === 0) {
    throw new Error("Decomposer returned no steps");
  }
  return steps;
};

const parseSteps = (text: string): string[] => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Decomposer returned no structured steps");
  }
  return normalizeSteps(JSON.parse(match[0]) as unknown);
};

export const decomposeRequest = async (
  request: string,
  dependencies: { query?: typeof query } = {},
): Promise<Decomposition> => {
  const model = process.env.JCR_CLAUDE_MODEL ?? "haiku";
  const runQuery = dependencies.query ?? query;
  let text = "";
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let costUsd: number | undefined;

  for await (const message of runQuery({
    prompt: `${instructions}\n\nRequest: ${request}`,
    options: {
      model,
      tools: [],
      allowedTools: [],
      settingSources: [],
      maxTurns: 1,
      permissionMode: "bypassPermissions",
    },
  })) {
    if (message.type === "result") {
      if (message.subtype !== "success" || message.is_error) {
        throw new Error(`Decomposer stopped with ${message.subtype}`);
      }
      text = message.result;
      inputTokens = message.usage.input_tokens;
      cachedInputTokens = message.usage.cache_read_input_tokens;
      outputTokens = message.usage.output_tokens;
      costUsd = message.total_cost_usd;
    }
  }

  return {
    steps: parseSteps(text),
    metrics: {
      model,
      calls: 1,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      ...(costUsd !== undefined ? { costUsd } : {}),
    },
  };
};
