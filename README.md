<div align="center">

# Kiri-Pi-ModelEffort

[![npm version](https://img.shields.io/npm/v/kiri-pi-model-effort)](https://www.npmjs.com/package/kiri-pi-model-effort)
[![Pi package](https://img.shields.io/badge/Pi-package-6f42c1)](https://pi.dev/packages/kiri-pi-model-effort)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Persist separate reasoning-effort presets for Claude and GPT models in [Pi](https://pi.dev).

为 Pi 的 Claude 与 GPT 模型分别保存并自动切换推理 effort。

</div>

## Download / 下载

- **npm:** <https://www.npmjs.com/package/kiri-pi-model-effort>
- **Pi installation via npm / 通过 npm 安装：** `pi install npm:kiri-pi-model-effort`
- **Pi installation via Git / 通过 Git 安装：** `pi install git:github.com/DayLight109/Kiri-Pi-ModelEffort`
- **GitHub source ZIP / 源码压缩包：** <https://github.com/DayLight109/Kiri-Pi-ModelEffort/archive/refs/heads/main.zip>

## Features

- Keeps independent presets for **Anthropic/Claude** and **OpenAI/GPT** model families.
- Applies the matching preset on Pi startup, session reload, resume, and model switch.
- Supports all Pi thinking levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`.
- Offers an interactive `/effort` selector, direct command arguments, aliases, and autocomplete.
- Shows the effective effort in Pi's footer.
- Uses Pi's own `setThinkingLevel()` API, so unsupported levels are safely clamped by the active model.
- Reuses the original `~/.pi/agent/effort-presets.json` file, so existing local presets migrate automatically.

## Installation

```bash
pi install npm:kiri-pi-model-effort
```

Restart Pi or run `/reload` after installation if Pi is already open.

To try the package without adding it to settings:

```bash
pi -e npm:kiri-pi-model-effort
```

## Usage

### Interactive selection

```text
/effort
```

Pi detects the current model family and opens a list of levels supported by the active model.

### Set the active model family's preset

```text
/effort high
/effort max
/effort off
```

### Set a specific family, even when it is not active

```text
/effort anthropic max
/effort gpt high
```

The preset is saved immediately and applied when you switch to that model family.

### Aliases

| Input | Resolves to |
|---|---|
| `claude` | `anthropic` |
| `openai` | `gpt` |
| `none` | `off` |
| `min` | `minimal` |
| `med` | `medium` |
| `extra` | `xhigh` |

Examples:

```text
/effort claude extra
/effort openai med
```

## How model detection works

The extension classifies a model as:

- **Anthropic/Claude** when its provider or model ID contains `anthropic` or `claude`.
- **OpenAI/GPT** when its provider/model ID identifies OpenAI, or its model ID starts with `gpt-` or `chatgpt-`.

This also works with many proxy or gateway model IDs such as `anthropic/claude-*` and `openai/gpt-*`. Other model families are intentionally left unchanged.

## Persistence

Presets are stored in:

```text
$PI_CODING_AGENT_DIR/effort-presets.json
```

When `PI_CODING_AGENT_DIR` is not set, Pi's default location is:

```text
~/.pi/agent/effort-presets.json
```

Example:

```json
{
  "anthropic": "max",
  "gpt": "high"
}
```

The extension does not read API keys, prompts, conversations, or model responses, and it makes no network requests.

## 中文说明

`Kiri-Pi-ModelEffort` 会给 Claude 和 GPT 两类模型分别保存 effort。例如，你可以让 Claude 默认使用 `max`，GPT 默认使用 `high`。以后通过 `/model` 或快捷键切换模型时，对应预设会自动生效。

常用命令：

```text
/effort                  # 根据当前模型打开选择器
/effort high             # 设置当前模型系列
/effort anthropic max    # 设置 Claude 系列
/effort gpt medium       # 设置 GPT 系列
```

如果某个模型不支持你保存的等级，Pi 会自动限制到该模型实际支持的等级；底部状态栏显示的是实际生效值，而预设仍保留，方便切换到能力更完整的模型后继续使用。

## Updating and removal

```bash
pi update npm:kiri-pi-model-effort
pi remove npm:kiri-pi-model-effort
```

Removing the package does not delete `effort-presets.json`.

## Development

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/DayLight109/Kiri-Pi-ModelEffort.git
cd Kiri-Pi-ModelEffort
npm install
npm run check
pi --no-extensions -e ./src/index.ts
```

## License

[MIT](LICENSE) © 2026 DayLight109
