# Nolane Agent 0.0.1

<div align="center">
  <img src="build/icon.svg" width="112" alt="Nolane Agent 标志" />
  <h3>面向严肃 AI 工作的本地优先指挥中心。</h3>
  <p>让 AI agent 在真实项目中工作：模型、工具、技能、浏览器、审批、证据与恢复，都在一个桌面工作区中完成。</p>

  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/github/v/release/Nolane-x/Nolane-agent?display_name=tag&sort=semver" alt="发行版本" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Nolane-x/Nolane-agent/ci.yml?label=verification" alt="验证" /></a>
  <a href="https://github.com/Nolane-x/Nolane-agent/releases/tag/v0.0.1"><img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-7c6cf0" alt="Windows、macOS 和 Linux" /></a>
</div>

<p align="center">
  <a href="README.md">English</a> · <a href="README.vi.md">Tiếng Việt</a> · <strong>简体中文</strong> · <a href="README.hi.md">हिन्दी</a>
</p>

Nolane Agent 不是另一个空白聊天框。它是一个**理解项目的 AI 工作区**：先选定本地文件夹、运行时、模型、effort、技能与审批边界；再持续查看 agent 如何规划、调用工具、浏览网页、验证结果、记录证据并在需要时恢复。

## 下载 Nolane Agent 0.0.1

| 平台 | 安装包 |
| --- | --- |
| Windows | [NSIS 安装程序 (.exe)](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-Setup-0.0.1-x64.exe) |
| macOS | [DMG](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.dmg) 或 [ZIP](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x64.zip) |
| Linux | [AppImage](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-x86_64.AppImage) 或 [Debian 软件包](https://github.com/Nolane-x/Nolane-agent/releases/download/v0.0.1/NolaneAgent-0.0.1-amd64.deb) |

## 为什么选择 Nolane Agent？

- **在真实项目中工作** — agent 行动前先选择本地文件夹；可在对话、文件、终端、diff、浏览器活动与实际执行之间自然切换。
- **使用已有的 agent 运行时** — 发现受支持的 API 与 CLI provider，涵盖 Codex、Claude、Gemini、OpenCode 以及本地/兼容生态。
- **诚实的模型控制** — 仅当 provider 真正能够执行选择时才公开模型选项，而不是伪造“所有模型都通用”的设置。
- **正确地调节 effort** — 在运行时支持时提供按模型的 effort 选择；不支持时保留 provider 原生默认行为。
- **始终保有控制权** — Ask for approval、Approve for me 和 Full access 三种模式；计划、工具操作、结果与 receipt 都可审阅。
- **可积累的技能系统** — 搜索、检查、安装并附加带 provenance 的本地与 Forge OS skills；插件和 MCP 仍由 Control Plane 管理。
- **从简单到专业的界面** — Everyday、Workspace、Studio、Expert 四个层级逐步展现能力，而不隐藏实际运行状态。
- **有意识地恢复** — 持久 checkpoint、上下文错误状态、重启前 snapshot 与运行中 mission 的安全保护。

## 一个完整的控制闭环

```text
意图 / 对话
  → 选定项目、provider、模型、effort 与技能
  → 可观察的 mission 计划与任务
  → 受治理的工具、终端、浏览器与 agent runtime
  → 审阅、验证、证据与恢复
```

| 你的需求 | Nolane Agent 提供 |
| --- | --- |
| 值得信赖的工作地点 | 明确选定的本地项目，而不是脱离项目的孤立 prompt。 |
| 强大而不黑箱的 AI | 依据实际能力呈现模型、effort 与 provider 能力。 |
| 有边界的自动化 | 审批模式、receipt、checkpoint 与 recovery，而不是交出全部控制权。 |
| 会不断积累的系统 | 带 provenance 的 skills、插件与 MCP，并由 Control Plane 统一治理。 |
| 能持续更新的桌面应用 | 原生安装包、更新 metadata、checksum、原地升级 Windows 并保留应用数据。 |

## 五分钟开始使用

1. 下载适合操作系统的安装包。
2. 选择或创建 agent 要工作的本地项目。
3. 连接可用的 provider 或 CLI runtime；如运行时支持，再选择模型与 effort。
4. 描述 mission。Nolane 会在工作进行时持续显示计划、操作状态、审批边界与恢复路径。

## 桌面发行与更新

每个发行版都完全由 GitHub Actions 打包。`v0.0.1` 包含 Windows 安装程序、macOS DMG/ZIP、Linux AppImage/DEB、更新 metadata、SHA-256 checksums 和 provenance attestation。

当出现新的 GitHub Release 时，应用会显示 **Download update**，随后由用户选择 **Update and restart**。更新不会自动安装；进行中的 mission 会阻止重启，直到安全为止。NSIS 会原地替换 Windows 安装，同时保留应用数据目录。

当前 artifact 尚未进行代码签名：Windows 可能显示 **Unknown Publisher**，macOS Gatekeeper 可能要求明确确认后才能打开。这是公开的限制，而不是被隐藏的缺陷。

## 诚实的范围说明

Nolane Agent 为已列能力提供源码、测试与 CI 证据，但不会宣称每个外部环境都已经证明。真实 provider credential、独立 accessibility、所有硬件/平台旅程和 public-release replay 均有各自的证据要求。

## 发行文档

- [Release notes](docs/RELEASE-0.0.1.md)
- [已知限制](docs/LIMITATIONS-0.0.1.md)
- [验证范围](docs/VERIFICATION-REPORT-0.0.1.md)
- [剩余差距](docs/REMAINING-GAPS-0.0.1.md)

`docs/`、`docs/checkpoints/`、`requirements/` 与 `evidence/` 中的 checkpoint、beta、audit 和 forensic 文件属于历史 provenance，不是当前产品品牌。
