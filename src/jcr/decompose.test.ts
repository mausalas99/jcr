import assert from "node:assert/strict";
import { test } from "node:test";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { decomposeRequest } from "./decompose.js";

const fakeQuery = (result: string): Query => {
  const messages: SDKMessage[] = [
    {
      type: "result",
      subtype: "success",
      is_error: false,
      result,
      usage: {
        input_tokens: 12,
        output_tokens: 8,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    } as unknown as SDKMessage,
  ];
  return (async function* () {
    for (const message of messages) yield message;
  })() as Query;
};

test("decomposes via Claude in a single turn", async () => {
  let seenPrompt: string | undefined;
  let seenModel: string | undefined;
  const result = await decomposeRequest(
    "Create a Stripe customer, then post its link in Slack.",
    {
      query: (params) => {
        seenPrompt = params.prompt as string;
        seenModel = params.options?.model;
        return fakeQuery(
          JSON.stringify({
            steps: ["Create a Stripe customer.", "Post its link in Slack."],
          }),
        );
      },
    },
  );

  assert.match(seenPrompt ?? "", /Create a Stripe customer/);
  assert.equal(seenModel, "haiku");
  assert.deepEqual(result.steps, [
    "Create a Stripe customer.",
    "Post its link in Slack.",
  ]);
  assert.deepEqual(result.metrics, {
    model: "haiku",
    calls: 1,
    inputTokens: 12,
    cachedInputTokens: 0,
    outputTokens: 8,
  });
});

test("rejects when Claude returns no structured steps", async () => {
  await assert.rejects(
    decomposeRequest("Create a Stripe customer.", {
      query: () => fakeQuery("not json"),
    }),
  );
});
