import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ModelThinkingLevel as ThinkingLevel } from "@earendil-works/pi-ai";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai/compat";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  detectModelFamily,
  familyLabel,
  isThinkingLevel,
  normalizePresets,
  parseEffortArgs,
  THINKING_LEVELS,
  type EffortPresets,
  type ModelFamily,
} from "./core.js";

const STATUS_ID = "kiri-pi-model-effort";
const STATE_FILENAME = "effort-presets.json";

export interface ModelEffortOptions {
  /** Override persistence path. Primarily useful for tests and embedded runtimes. */
  statePath?: string;
}

export function getDefaultStatePath(): string {
  return join(getAgentDir(), STATE_FILENAME);
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function readPresets(path: string): Promise<EffortPresets> {
  try {
    return normalizePresets(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (!isMissingFile(error)) {
      console.warn(
        `[kiri-pi-model-effort] Could not load ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return {};
  }
}

async function writePresets(path: string, presets: EffortPresets): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporary, `${JSON.stringify(presets, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function availableLevels(ctx: ExtensionContext, family: ModelFamily): ThinkingLevel[] {
  const activeFamily = detectModelFamily(ctx.model);
  if (activeFamily !== family || !ctx.model?.reasoning) return [...THINKING_LEVELS];

  return getSupportedThinkingLevels(ctx.model).filter(isThinkingLevel);
}

/** Register the model-effort extension. */
export function createModelEffortExtension(
  pi: ExtensionAPI,
  options: ModelEffortOptions = {},
): void {
  const statePath = options.statePath ?? getDefaultStatePath();
  let presets: EffortPresets = {};
  let loadPromise: Promise<void> | undefined;

  const ensureLoaded = (): Promise<void> => {
    loadPromise ??= readPresets(statePath).then((loaded) => {
      presets = loaded;
    });
    return loadPromise;
  };

  const updateStatus = (ctx: ExtensionContext): void => {
    const family = detectModelFamily(ctx.model);
    if (!family || !ctx.model?.reasoning) {
      ctx.ui.setStatus(STATUS_ID, undefined);
      return;
    }

    const level = pi.getThinkingLevel();
    ctx.ui.setStatus(
      STATUS_ID,
      ctx.ui.theme.fg("dim", `${family === "anthropic" ? "Claude" : "GPT"} effort: `) +
        ctx.ui.theme.fg(level === "off" ? "muted" : "accent", level),
    );
  };

  const applyPreset = async (ctx: ExtensionContext): Promise<void> => {
    await ensureLoaded();
    const family = detectModelFamily(ctx.model);
    if (family && ctx.model?.reasoning) {
      const preset = presets[family];
      if (preset) pi.setThinkingLevel(preset);
    }
    updateStatus(ctx);
  };

  pi.on("session_start", async (_event, ctx) => {
    await applyPreset(ctx);
  });

  pi.on("model_select", async (_event, ctx) => {
    await applyPreset(ctx);
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    updateStatus(ctx);
  });

  pi.registerCommand("effort", {
    description: "设置 Anthropic/Claude 或 GPT/OpenAI 的推理 effort",
    getArgumentCompletions: (prefix) => {
      const families: ModelFamily[] = ["anthropic", "gpt"];
      const options = [
        ...THINKING_LEVELS.map((level) => ({ value: level, label: level })),
        ...families.map((family) => ({ value: family, label: family })),
        ...families.flatMap((family) =>
          THINKING_LEVELS.map((level) => ({
            value: `${family} ${level}`,
            label: `${family} ${level}`,
          })),
        ),
      ];
      const normalized = prefix.trimStart().toLowerCase();
      const matches = options.filter((item) => item.value.startsWith(normalized));
      return matches.length > 0 ? matches : null;
    },
    handler: async (rawArgs, ctx) => {
      await ensureLoaded();
      const parsed = parseEffortArgs(rawArgs);
      if (parsed.error) {
        ctx.ui.notify(parsed.error, "warning");
        return;
      }

      const activeFamily = detectModelFamily(ctx.model);
      const family = parsed.family ?? activeFamily;
      if (!family) {
        ctx.ui.notify(
          "当前不是 Anthropic/Claude 或 GPT/OpenAI 模型，请指定系列：/effort anthropic high",
          "warning",
        );
        return;
      }

      let level = parsed.level;
      if (!level) {
        if (!ctx.hasUI) {
          ctx.ui.notify(
            "当前模式无法打开选择器，请显式指定：/effort [anthropic|gpt] [off|minimal|low|medium|high|xhigh|max]",
            "warning",
          );
          return;
        }

        const levels = availableLevels(ctx, family);
        if (levels.length === 0) {
          ctx.ui.notify(`${ctx.model?.id ?? familyLabel(family)} 没有可用的 effort 级别`, "warning");
          return;
        }

        const selected = await ctx.ui.select(
          `${familyLabel(family)} effort（当前预设：${presets[family] ?? "未设置"}）`,
          levels,
        );
        if (!isThinkingLevel(selected)) return;
        level = selected;
      }

      const previous = presets[family];
      presets[family] = level;
      try {
        await writePresets(statePath, presets);
      } catch (error) {
        if (previous) presets[family] = previous;
        else delete presets[family];
        ctx.ui.notify(
          `effort 预设保存失败：${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        return;
      }

      if (activeFamily !== family) {
        ctx.ui.notify(
          `${familyLabel(family)} effort 预设已保存为 ${level}，切换到该系列模型时自动应用`,
          "info",
        );
        return;
      }

      if (!ctx.model?.reasoning) {
        updateStatus(ctx);
        ctx.ui.notify(
          `${familyLabel(family)} effort 预设已保存为 ${level}；当前模型未启用 reasoning，将在支持的模型上自动应用`,
          "warning",
        );
        return;
      }

      pi.setThinkingLevel(level);
      const effective = pi.getThinkingLevel();
      updateStatus(ctx);
      ctx.ui.notify(
        effective === level
          ? `${familyLabel(family)} effort 已设为 ${effective}`
          : `${familyLabel(family)} effort 预设为 ${level}，当前模型实际使用 ${effective}`,
        "info",
      );
    },
  });
}

export default function modelEffort(pi: ExtensionAPI): void {
  createModelEffortExtension(pi);
}
