# Wailf 文档导航

这里是 Wailf 的工程文档入口。文档以中文为主，代码标识、字段名、命令和稳定的协议名称保留英文，便于搜索和实现。

## 推荐阅读路径

### 项目负责人或产品设计

1. [产品需求基线](product/requirements.md)
2. [架构总览](architecture/overview.md)
3. [主题与平台适配](architecture/theme-and-platform.md)（涉及 GUI 平台边界时）
4. [领域模型与持久化](architecture/domain-model-and-storage.md)
5. [首个垂直切片：资产侦察与端口扫描](features/port-scan.md)
6. [ADR 索引](adr/README.md)

### 后端贡献者

1. [架构总览](architecture/overview.md)
2. [后端架构](architecture/backend.md)
3. [领域模型与持久化](architecture/domain-model-and-storage.md)
4. [入口契约](architecture/entry-contracts.md)
5. [安全与治理](security/governance.md)
6. [开发与贡献](development/contributing.md)

### 前端贡献者

1. [产品需求基线](product/requirements.md)
2. [前端架构](architecture/frontend.md)
3. [前端开发规范](development/frontend-conventions.md)
4. [主题与平台适配](architecture/theme-and-platform.md)
5. [入口契约](architecture/entry-contracts.md)
6. [领域模型与持久化](architecture/domain-model-and-storage.md)
7. [开发与贡献](development/contributing.md)

### 第一次参与项目的新贡献者

先读本页、[README](../README.md)、[产品需求基线](product/requirements.md) 和 [开发与贡献](development/contributing.md)，再根据任务选择前端、后端或入口文档。不要直接从 Wails 生成的 `frontend/bindings/` 文件开始阅读或修改。

## 文档目录

| 文档 | 作用 | 状态 |
| --- | --- | --- |
| [产品需求基线](product/requirements.md) | 产品范围、能力域、默认导航和路线 | `accepted` |
| [架构总览](architecture/overview.md) | 系统上下文、运行模式和依赖规则 | `accepted` |
| [前端架构](architecture/frontend.md) | Vue/Wails 外壳、状态、路由和配置 | `accepted` |
| [主题与平台适配](architecture/theme-and-platform.md) | GUI 平台主题、token、hook、资源和回退契约 | `accepted` |
| [后端架构](architecture/backend.md) | Go 领域切片、平台服务和入口组装 | `accepted` |
| [领域模型与持久化](architecture/domain-model-and-storage.md) | 核心对象、状态机、SQLite 和产物 | `accepted` |
| [入口契约](architecture/entry-contracts.md) | GUI、CLI、MCP、HTTP 的边界 | `accepted` |
| [端口扫描切片](features/port-scan.md) | 第一条端到端业务链路 | `designing` |
| [安全与治理](security/governance.md) | 授权、审计、秘密和数据保留 | `accepted` |
| [前端开发规范](development/frontend-conventions.md) | 前端目录、组件来源和语言包规则唯一来源 | `accepted` |
| [开发与贡献](development/contributing.md) | 上手、加功能和文档流程 | `accepted` |
| [测试与发布](development/testing-and-release.md) | 测试、构建、迁移、备份和发布 | `accepted` |
| [adr/](adr/README.md) | 可追溯的架构决策记录 | `accepted` |

目录及普通文档文件名使用小写英文 kebab-case。`product/` 放需求，`architecture/` 放架构和契约，`features/` 放领域流程，`development/` 放开发测试，`security/` 放治理，`adr/` 保留编号决策。README 和历史 ADR 文件名保留惯例；不保留旧路径的重复正文。

## 如何维护文档

- 产品范围变更先更新 [产品需求基线](product/requirements.md)，架构取舍同时新增或更新 ADR。
- 对象名称、状态值和错误字段以 [领域模型与持久化](architecture/domain-model-and-storage.md) 为准；入口文档不能自行发明同义词。
- 新增领域时先补领域边界和入口暴露表，再补 UI 页面或 Go 实现。
- 新增主题 token、平台 hook 或主题资源时，先遵循[主题与平台适配](architecture/theme-and-platform.md)的 schema v1、GUI-only 和资源打包约束，并同步检查 [ADR-0008](adr/ADR-0008-平台主题与用户主题分层.md)。
- 任何文档示例都必须标明是“概念契约”还是“可复制命令”；高风险能力只写概念契约和安全约束。
- 删除或替换既有决策时，不要静默覆盖，必须在 ADR 中记录原因、影响和迁移方式。

## 文档状态

| 状态 | 含义 |
| --- | --- |
| `draft` | 正在讨论，不能作为实现依据 |
| `designing` | 范围已定，接口或流程仍在细化 |
| `accepted` | 可以作为实现和评审依据 |
| `deprecated` | 已被新文档替代，仅保留历史信息 |
| `superseded` / `partially superseded` | ADR 已全部或部分被后续决策替代；按替代记录读取现行约束 |

## 约定的稳定词汇

`TargetScope`、`Asset`、`Job`、`Artifact`、`Session`、`SessionChannel`、`Connector`、`AuditEntry` 和 `Entry Adapter` 具有固定含义。它们的关系和状态机见 [领域模型与持久化](architecture/domain-model-and-storage.md)。
