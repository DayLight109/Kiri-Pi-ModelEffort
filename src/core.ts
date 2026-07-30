import type { ModelThinkingLevel as ThinkingLevel } from "@earendil-works/pi-ai";

export type ModelFamily = "anthropic" | "gpt";
export type EffortPresets = Partial<Record<ModelFamily, ThinkingLevel>>;

export interface ModelIdentity {
  provider?: string;
  id?: string;
}

export interface ParsedEffortArgs {
  family?: ModelFamily;
  level?: ThinkingLevel;
  error?: string;
}

export const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

const LEVEL_ALIASES: Readonly<Record<string, ThinkingLevel>> = {
  off: "off",
  none: "off",
  minimal: "minimal",
  min: "minimal",
  low: "low",
  medium: "medium",
  med: "medium",
  high: "high",
  xhigh: "xhigh",
  extra: "xhigh",
  max: "max",
};

const FAMILY_ALIASES: Readonly<Record<string, ModelFamily>> = {
  anthropic: "anthropic",
  claude: "anthropic",
  gpt: "gpt",
  openai: "gpt",
};

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && THINKING_LEVELS.includes(value as ThinkingLevel);
}

export function detectModelFamily(model: ModelIdentity | undefined): ModelFamily | undefined {
  const provider = model?.provider?.toLowerCase() ?? "";
  const id = model?.id?.toLowerCase() ?? "";
  const identity = `${provider}/${id}`;

  if (identity.includes("anthropic") || identity.includes("claude")) return "anthropic";
  if (
    identity.includes("openai") ||
    id.startsWith("gpt-") ||
    id.includes("/gpt-") ||
    id.startsWith("chatgpt-")
  ) {
    return "gpt";
  }

  return undefined;
}

export function familyLabel(family: ModelFamily): string {
  return family === "anthropic" ? "Anthropic/Claude" : "GPT/OpenAI";
}

export function parseEffortArgs(raw: string): ParsedEffortArgs {
  const args = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (args.length === 0) return {};
  if (args.length > 2) {
    return { error: "用法：/effort [anthropic|gpt] [off|minimal|low|medium|high|xhigh|max]" };
  }

  const first = args[0];
  if (!first) return {};

  if (args.length === 1) {
    const level = LEVEL_ALIASES[first];
    if (level) return { level };

    const family = FAMILY_ALIASES[first];
    if (family) return { family };

    return { error: `未知的 effort 或模型系列：${first}` };
  }

  const family = FAMILY_ALIASES[first];
  const second = args[1];
  const level = second ? LEVEL_ALIASES[second] : undefined;
  if (!family) return { error: `未知模型系列：${first}` };
  if (!level) return { error: `未知 effort：${second ?? ""}` };
  return { family, level };
}

export function normalizePresets(value: unknown): EffortPresets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const record = value as Record<string, unknown>;
  const presets: EffortPresets = {};
  if (isThinkingLevel(record.anthropic)) presets.anthropic = record.anthropic;
  if (isThinkingLevel(record.gpt)) presets.gpt = record.gpt;
  return presets;
}
