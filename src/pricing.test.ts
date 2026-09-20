import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDecomposerCostUsd,
  estimateJevCostUsd,
  estimateOpenAiCostUsd,
  openAiListPrice,
} from "./pricing.js";

const tokens = {
  inputTokens: 1_000_000,
  cachedInputTokens: 500_000,
  cacheWriteInputTokens: 100_000,
  outputTokens: 200_000,
};

test("prices gpt-5.6-luna at list rates per token class", () => {
  const cost = estimateOpenAiCostUsd("gpt-5.6-luna", tokens);
  assert.ok(cost !== undefined);
  assert.ok(Math.abs(cost - (0.2 + 0.01 + 0.025 + 0.24)) < 1e-9);
});

test("doubles the list price on the fast service tier", () => {
  const standard = estimateOpenAiCostUsd("gpt-5.6-luna", tokens, "standard");
  const fast = estimateOpenAiCostUsd("gpt-5.6-luna", tokens, "fast");
  assert.ok(standard !== undefined && fast !== undefined);
  assert.ok(Math.abs(fast - standard * 2) < 1e-9);
});

test("matches dated model snapshots by prefix and rejects unknown models", () => {
  assert.deepEqual(
    openAiListPrice("gpt-5.6-terra-2026-06-01"),
    openAiListPrice("gpt-5.6-terra"),
  );
  assert.equal(openAiListPrice("gpt-5.6-lunar"), undefined);
  assert.equal(estimateOpenAiCostUsd("mystery-model", tokens), undefined);
});

test("prices Jev on input tokens only", () => {
  assert.ok(Math.abs(estimateJevCostUsd(1_000_000) - 0.042) < 1e-12);
  assert.equal(estimateJevCostUsd(0), 0);
});

test("passes through the decomposer's SDK-reported cost", () => {
  assert.equal(
    estimateDecomposerCostUsd({
      model: "haiku",
      calls: 1,
      inputTokens: 1_000_000,
      cachedInputTokens: 400_000,
      outputTokens: 100_000,
      costUsd: 0.0123,
    }),
    0.0123,
  );
  assert.equal(
    estimateDecomposerCostUsd({
      model: "haiku",
      calls: 1,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    }),
    undefined,
  );
});
