import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ModelThinkingLevel as ThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createModelEffortExtension } from "../src/index.js";

type EventHandler = (event: unknown, ctx: ExtensionContext) => unknown;

interface RegisteredCommand {
  handler: (args: string, ctx: ExtensionContext) => Promise<void> | void;
  getArgumentCompletions?: (
    prefix: string,
  ) => Array<{ value: string; label: string }> | null;
}

interface Harness {
  pi: ExtensionAPI;
  handlers: Map<string, EventHandler[]>;
  commands: Map<string, RegisteredCommand>;
  notifications: Array<{ message: string; level: string }>;
  statuses: Map<string, string | undefined>;
  getLevel: () => ThinkingLevel;
  setClamp: (level: ThinkingLevel | undefined) => void;
  context: (provider: string, id: string, reasoning?: boolean) => ExtensionContext;
}

function createHarness(initialLevel: ThinkingLevel = "off"): Harness {
  const handlers = new Map<string, EventHandler[]>();
  const commands = new Map<string, RegisteredCommand>();
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();
  let currentLevel = initialLevel;
  let clamp: ThinkingLevel | undefined;

  const pi = {
    on(name: string, handler: EventHandler) {
      const registered = handlers.get(name) ?? [];
      registered.push(handler);
      handlers.set(name, registered);
    },
    registerCommand(name: string, command: RegisteredCommand) {
      commands.set(name, command);
    },
    getThinkingLevel() {
      return currentLevel;
    },
    setThinkingLevel(level: ThinkingLevel) {
      currentLevel = clamp ?? level;
    },
  } as unknown as ExtensionAPI;

  const context = (
    provider: string,
    id: string,
    reasoning = true,
  ): ExtensionContext =>
    ({
      model: {
        provider,
        id,
        reasoning,
      },
      get thinkingLevel() {
        return currentLevel;
      },
      hasUI: true,
      ui: {
        theme: {
          fg: (_color: string, text: string) => text,
        },
        setStatus: (name: string, value: string | undefined) => {
          statuses.set(name, value);
        },
        notify: (message: string, level: string) => {
          notifications.push({ message, level });
        },
        select: async () => undefined,
      },
    }) as unknown as ExtensionContext;

  return {
    pi,
    handlers,
    commands,
    notifications,
    statuses,
    getLevel: () => currentLevel,
    setClamp: (level) => {
      clamp = level;
    },
    context,
  };
}

async function emit(
  harness: Harness,
  eventName: string,
  ctx: ExtensionContext,
): Promise<void> {
  for (const handler of harness.handlers.get(eventName) ?? []) {
    await handler({}, ctx);
  }
}

describe("model effort extension", () => {
  it("loads, applies, saves, and switches independent family presets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kiri-pi-model-effort-"));
    const statePath = join(directory, "effort-presets.json");

    try {
      await writeFile(statePath, '{"anthropic":"low","gpt":"max"}\n', "utf8");
      const harness = createHarness("off");
      createModelEffortExtension(harness.pi, { statePath });

      const gptContext = harness.context("agent", "gpt-5.6-sol");
      await emit(harness, "session_start", gptContext);
      assert.equal(harness.getLevel(), "max");
      assert.equal(harness.statuses.get("kiri-pi-model-effort"), "GPT effort: max");

      const command = harness.commands.get("effort");
      assert.ok(command, "the /effort command should be registered");
      assert.ok(
        command.getArgumentCompletions?.("anthropic m")?.some((item) => item.value === "anthropic max"),
      );

      await command.handler("gpt high", gptContext);
      assert.equal(harness.getLevel(), "high");
      assert.match(harness.notifications.at(-1)?.message ?? "", /已设为 high/);

      await command.handler("claude min", gptContext);
      assert.equal(harness.getLevel(), "high", "an inactive family's preset must not change the active model");
      assert.match(harness.notifications.at(-1)?.message ?? "", /切换到该系列模型时自动应用/);

      assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
        anthropic: "minimal",
        gpt: "high",
      });

      const claudeContext = harness.context("gateway", "anthropic/claude-opus-4-7");
      await emit(harness, "model_select", claudeContext);
      assert.equal(harness.getLevel(), "minimal");
      assert.equal(harness.statuses.get("kiri-pi-model-effort"), "Claude effort: minimal");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports a model clamp while preserving the requested preset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kiri-pi-model-effort-"));
    const statePath = join(directory, "effort-presets.json");

    try {
      const harness = createHarness("off");
      harness.setClamp("medium");
      createModelEffortExtension(harness.pi, { statePath });
      const context = harness.context("openai", "gpt-limited");
      const command = harness.commands.get("effort");
      assert.ok(command);

      await command.handler("max", context);

      assert.equal(harness.getLevel(), "medium");
      assert.match(harness.notifications.at(-1)?.message ?? "", /预设为 max，当前模型实际使用 medium/);
      assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), { gpt: "max" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not create state when no supported family can be inferred", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kiri-pi-model-effort-"));
    const statePath = join(directory, "effort-presets.json");

    try {
      const harness = createHarness();
      createModelEffortExtension(harness.pi, { statePath });
      const command = harness.commands.get("effort");
      assert.ok(command);

      await command.handler("high", harness.context("google", "gemini-3-pro"));

      assert.match(harness.notifications.at(-1)?.message ?? "", /请指定系列/);
      await assert.rejects(readFile(statePath, "utf8"), { code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
