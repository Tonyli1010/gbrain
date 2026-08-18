# Obsidian AI Orange Book 与 GBrain 跨项目大脑调研笔记

调研日期：2026-08-16
调研目标：理解 alchaincyf/obsidian-ai-orange-book 的真实架构与工作流，评估以 GBrain 替代 Obsidian 作为蓝定跨项目大脑的增量价值、损失与可行路径。

## 关键问题

1. 该项目真正依赖 Obsidian 的哪些能力：文件容器、人工界面、链接图谱、插件，还是 Agent 读取协议？
2. GBrain 对这些能力能覆盖多少，并新增哪些跨项目检索、来源隔离、结构化事实、时间线与 Agent 记忆能力？
3. 完全替代、底层替代或共存，哪种架构更适合蓝定的现有工作方式？
4. 最小试点如何验证，而不是只凭功能表判断？

## 发现

### 目标仓库第一轮核验（GitHub API，2026-08-16）

- 仓库是一本“Obsidian + Claude Code”方法论书的发布仓库，README 提供中英文 PDF、封面与截图；README 没有把它描述成一套可安装的自动化系统。（来源：https://github.com/alchaincyf/obsidian-ai-orange-book ，GitHub API 读取 README）
- README 的三项核心主张是：Markdown 是 Agent 原生接口；LLM 应直接维护知识库而不只充当 RAG 检索器；`CLAUDE.md` 加每层 `index.md` 可以承担大部分导航工作。（同上）
- 仓库默认分支是 `master`，创建于 2026-04-11，最近一次代码推送时间为 2026-04-21；GitHub 页面更新时间为 2026-08-15。页面更新时间不等于内容更新，不能据此声称书稿近期更新。（来源：GitHub repository API，2026-08-16）
- 截至本次查询，GitHub API 返回 1,400 stars、130 forks；这些是时点数据，不用于判断方案优劣。（同上）

### 本地 GBrain 直接事实（2026-08-16）

- GBrain 用两个正交轴组织知识：brain 表示数据库与访问边界，source 表示同一 brain 内的项目/知识源；跨 brain 检索由 Agent 显式联邦并保留来源，不做静默混合。（来源：本仓库 `CLAUDE.md`、`docs/architecture/brains-and-sources.md`、`skills/conventions/brain-routing.md`）
- GBrain 原生支持把 Obsidian Markdown、frontmatter、tags 与 wikilinks 增量导入，并要求先抽样 5–10 个文件、回读校验，再批量迁移；源数据不得修改或删除。（来源：本仓库 `skills/migrate/SKILL.md`）
- GBrain 的定位是 Agent 的实时上下文与检索层，不只是归档；本地项目协议同时要求保留来源、引用和项目自治。（来源：本仓库 `skills/brain-ops/SKILL.md` 与既有项目治理判断）

## 来源列表

| 来源 | URL / 路径 | 日期 | 可信度 |
|---|---|---|---|
| GBrain 本地仓库 | `/Users/landing/gbrain/CLAUDE.md` | 2026-08-16 核验 | 高（一手） |
| GBrain 架构文档 | `/Users/landing/gbrain/docs/architecture/brains-and-sources.md` | 2026-08-16 核验 | 高（一手） |
| GBrain 迁移 Skill | `/Users/landing/gbrain/skills/migrate/SKILL.md` | 2026-08-16 核验 | 高（一手） |
| 目标仓库 README | `https://github.com/alchaincyf/obsidian-ai-orange-book` | 2026-08-16 读取 | 高（一手） |
| GitHub Repository API | `https://api.github.com/repos/alchaincyf/obsidian-ai-orange-book` | 2026-08-16 查询 | 高（一手、时点数据） |

## 待确认问题

- 中文与英文 PDF 下载多次因 GitHub raw/clone 连接中断，未得到结构完整的 PDF；因此本结论只引用已核实的 README、GitHub 元数据和本地 GBrain 一手文档，不声称读完书稿正文。
- README 声称书中涉及 4 个必要插件、7 个工作流、Git、多 Vault 等，但正文未能核验，因此不据此判断具体插件依赖或工作流细节。

## 调研结论

### 结论

**对于“跨项目大脑”这个目标，GBrain 比单独使用 Obsidian 更有优势；但不建议把它理解成完全替代 Obsidian 的编辑器。** 更稳妥的目标架构是：

1. 每个项目继续以本地 Markdown/Git 仓库保存原始材料、项目 Wiki、决策和正式输出，项目内自治。
2. GBrain 把每个项目注册为独立 `source`，承担跨项目检索、结构化事实/takes、关系图、时间线、矛盾与缺口发现、Agent 上下文。
3. Obsidian 可以保留为可选的人类浏览/编辑界面；不用它也不影响 GBrain，因为系统记录仍是普通 Markdown repo。
4. GBrain/Agent 可以生成索引、链接、冲突清单和候选判断，但不得静默改写项目正式结论；项目 Owner 保留授权权。

### 能力映射

| 维度 | Orange Book 路线（按已核实 README） | GBrain | 判断 |
|---|---|---|---|
| 系统记录 | Obsidian vault 中的 Markdown | Git repo 中的 Markdown，DB 是检索/记忆层 | 可兼容，不必二选一 |
| Agent 导航 | `CLAUDE.md` + 分层 `index.md` | hybrid search + source routing + graph + schema | GBrain 更适合跨项目召回；项目内索引仍应保留 |
| 跨项目 | 多 Vault 策略，具体机制未核验 | 一个 brain 多 source；不同数据 Owner 可拆 brain/mount | GBrain 边界更明确 |
| 关系 | 手工 wikilinks/Obsidian graph | wikilinks 自动建边、typed graph、多跳查询 | GBrain 更强 |
| 判断与时间 | 主要靠 Markdown 约定（正文未核验） | fact/take/bet/hunch、timeline、trajectory、contradiction | GBrain 更强 |
| Agent 接入 | 强依赖 Claude Code 直接读文件 | CLI + MCP，可接 Codex/Qoder/其他 Agent | GBrain 更适合三端共享 |
| 人类界面 | Obsidian 浏览、编辑、插件、Canvas | 不是同级桌面编辑器 | Obsidian 更强 |
| 运维成本 | 低，文件即可工作 | DB、embedding、sync、schema、health 需要治理 | Obsidian 更轻 |

### 当前实例是否已经具备条件（2026-08-16 实测）

- 可用基础已成立：GBrain `0.42.66.0`；5,205 pages；`default`、`curated`、`zeus` 三个 source；两个非默认 federated source 最近完成同步；embedding 100%；source routing 正常；active schema 为 `gbrain-base-v2`；feature brain score 为 86/100。
- 不能直接宣布“已经替代成功”：`doctor` 总体 health score 为 15，主要暴露 44 个实际 page types 与 active pack 17 个声明不一致；另有 114 个 multi-source drift、227 个 synthesized pages 缺 raw provenance、timeline coverage 41%、5 个 flagged pages，以及 atom extraction backlog。
- 当前 CLI 提示可升级到 `0.46.2.0`，但本次仅只读核验，没有升级。
- `doctor` 建议把 subagent 改成 Anthropic 以获得 prompt caching，这与 2026-08-09 的 dashscope-only 硬约束冲突，不能执行；应视为通用诊断建议，不是本机可接受修复。

### 推荐的最小试点（提案，不是既成事实）

选一个尚未进入 GBrain、资料量中等的项目，保留原目录不动：

1. 先盘点并选 5–10 个 Markdown 样本，设计 `project_id/source_id/type/status/owner/sources` 映射。
2. 以独立 source 导入样本，回读核对正文、frontmatter、wikilinks 和来源；不做项目 Wiki 写回。
3. 用同一组 20 个真实跨项目问题，对比 Obsidian/目录索引基线与 GBrain：命中、正确来源、回答耗时、冲突发现、错误串源。
4. 仅当样本源文件 100% 未变、20 问中正确来源率至少 95%、零静默串源、每个结论都能回到原文时，再考虑扩大范围。

### 不建议

- 不要把所有项目先搬进一个大 vault 再导入；项目自治边界会被抹平。
- 不要删除 Obsidian/vault 或把 DB 当唯一真相；Markdown/Git 仍应是可恢复的系统记录。
- 不要在当前 type proliferation、source drift、raw provenance 问题未盘清前做全量迁移。
- 不要用 Agent 自动整理的结果覆盖项目 Owner 的正式决策。

## 来源列表（最终）

| 来源 | URL / 路径 | 日期 | 可信度 |
|---|---|---|---|
| 目标仓库 README | `https://github.com/alchaincyf/obsidian-ai-orange-book` | 2026-08-16 读取 | 高（一手） |
| GitHub Repository API | `https://api.github.com/repos/alchaincyf/obsidian-ai-orange-book` | 2026-08-16 查询 | 高（一手、时点数据） |
| GBrain 本地 README | `/Users/landing/gbrain/README.md` | 2026-08-16 读取 | 高（一手） |
| GBrain 架构文档 | `/Users/landing/gbrain/docs/architecture/brains-and-sources.md` | 2026-08-16 读取 | 高（一手） |
| GBrain 迁移 Skill | `/Users/landing/gbrain/skills/migrate/SKILL.md` | 2026-08-16 读取 | 高（一手） |
| 当前实例只读检查 | `gbrain sources list/schema active/features/advisor/doctor --json` | 2026-08-16 实测 | 高（实测） |
