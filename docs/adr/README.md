# ADR 索引

ADR（Architecture Decision Record）记录会影响多个模块、入口或长期兼容性的取舍。ADR 不替代领域文档；它解释“为什么这样定”和“哪些方案被明确放弃”。被替代记录保留历史正文，但不再作为实现依据。

| 编号 | 标题 | 状态 |
| --- | --- | --- |
| [ADR-0001](ADR-0001-模块化单体与入口适配.md) | 模块化单体与入口适配 | `accepted` |
| [ADR-0002](ADR-0002-legacy-global-boundary.md) | 早期边界方案归档 | `deprecated` |
| [ADR-0003](ADR-0003-Job异步语义.md) | Job 异步语义 | `accepted` |
| [ADR-0004](ADR-0004-会话连接器边界.md) | 会话连接器边界 | `accepted` |
| [ADR-0005](ADR-0005-MCP传输与SDK待定.md) | MCP 传输与 SDK 选择 | `accepted / SDK pending` |
| [ADR-0006](ADR-0006-入口不对称与不设统一门面.md) | 入口不对称与不设统一门面 | `accepted` |
| [ADR-0007](ADR-0007-Vue前端基线.md) | Vue 前端基线 | `partially superseded by ADR-0010` |
| [ADR-0008](ADR-0008-平台主题与用户主题分层.md) | 平台主题与用户主题分层 | `accepted` |
| [ADR-0009](ADR-0009-global-application-data.md) | 应用级全局数据 | `accepted` |
| [ADR-0010](ADR-0010-frontend-ui-and-file-conventions.md) | 前端 UI 技术栈与文件规范 | `accepted` |
| [ADR-0011](ADR-0011-windows-acrylic-material.md) | Windows 原生 Acrylic 材质 | `accepted` |

## 维护规则

文件名使用 `ADR-NNNN-短标题.md`；至少包含状态、背景、决策、后果、被否决方案和关联文档。已接受的 ADR 不应静默改写；取舍变化时新增替代 ADR，并在旧记录中标记 `superseded`。

主题实现的规范文档是[主题与平台适配](../architecture/theme-and-platform.md)。主题 token、平台 hook、GUI-only 边界或 runtime 版本锁定发生变化时，同时检查 ADR-0008；Windows 材质与窗口适配检查 ADR-0011。
