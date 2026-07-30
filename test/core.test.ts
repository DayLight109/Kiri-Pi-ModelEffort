import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectModelFamily,
  familyLabel,
  isThinkingLevel,
  normalizePresets,
  parseEffortArgs,
  THINKING_LEVELS,
} from "../src/core.js";

describe("detectModelFamily", () => {
  it("detects Anthropic models by provider or model ID", () => {
    assert.equal(detectModelFamily({ provider: "anthropic", id: "custom" }), "anthropic");
    assert.equal(detectModelFamily({ provider: "gateway", id: "anthropic/claude-opus-4-7" }), "anthropic");
  });

  it("detects GPT models through direct and proxied identities", () => {
    assert.equal(detectModelFamily({ provider: "openai", id: "custom" }), "gpt");
    assert.equal(detectModelFamily({ provider: "agent", id: "gpt-5.6-sol" }), "gpt");
    assert.equal(detectModelFamily({ provider: "gateway", id: "openai/gpt-5.4" }), "gpt");
  });

  it("leaves unrelated families unchanged", () => {
    assert.equal(detectModelFamily({ provider: "google", id: "gemini-3-pro" }), undefined);
    assert.equal(detectModelFamily(undefined), undefined);
  });
});

describe("parseEffortArgs", () => {
  it("parses current-family levels and aliases", () => {
    assert.deepEqual(parseEffortArgs("high"), { level: "high" });
    assert.deepEqual(parseEffortArgs(" NONE "), { level: "off" });
    assert.deepEqual(parseEffortArgs("extra"), { level: "xhigh" });
  });

  it("parses explicit families and aliases", () => {
    assert.deepEqual(parseEffortArgs("anthropic max"), { family: "anthropic", level: "max" });
    assert.deepEqual(parseEffortArgs("Claude min"), { family: "anthropic", level: "minimal" });
    assert.deepEqual(parseEffortArgs("openai med"), { family: "gpt", level: "medium" });
    assert.deepEqual(parseEffortArgs("gpt"), { family: "gpt" });
  });

  it("returns useful errors for invalid input", () => {
    assert.match(parseEffortArgs("unknown")?.error ?? "", /未知/);
    assert.match(parseEffortArgs("gpt impossible")?.error ?? "", /未知 effort/);
    assert.match(parseEffortArgs("gpt high extra")?.error ?? "", /用法/);
  });
});

describe("preset normalization", () => {
  it("accepts only supported family-level pairs", () => {
    assert.deepEqual(
      normalizePresets({ anthropic: "max", gpt: "medium", gemini: "high" }),
      { anthropic: "max", gpt: "medium" },
    );
    assert.deepEqual(normalizePresets({ anthropic: "turbo", gpt: 3 }), {});
    assert.deepEqual(normalizePresets(null), {});
  });

  it("recognizes every Pi thinking level", () => {
    assert.deepEqual(THINKING_LEVELS.filter(isThinkingLevel), THINKING_LEVELS);
    assert.equal(isThinkingLevel("turbo"), false);
    assert.equal(familyLabel("anthropic"), "Anthropic/Claude");
    assert.equal(familyLabel("gpt"), "GPT/OpenAI");
  });
});
