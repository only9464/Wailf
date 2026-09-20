# ADR-0002：Workspace 与存储边界

- 状态：`superseded`
- 日期：2026-09-19
- 替代：[ADR-0009：应用级全局数据与独立授权范围](ADR-0009-global-application-data.md)（2026-09-20）

> 以下正文保留当时的决策及解释，已不构成现行实现约束；SQLite、文件产物与密钥库的存储分工由 ADR-0009 延续。

## 背景

资产、任务、会话和产物需要按项目隔离；GUI 布局又是纯界面状态。把所有数据放进 localStorage 会失去查询、审计和跨入口能力，把所有内容放入数据库又会让大文件和移动端备份变得笨重。

## 决策

- Workspace 是所有业务对象的隔离边界，即使首期只有本地单用户。
- SQLite 保存元数据、状态、索引和小型结构化摘要。
- 文件 Artifact Store 保存扫描原始输出、日志、附件和导出包，数据库只保存引用、哈希、大小和保留策略。
- 凭据只存系统密钥库，SQLite 只保存 CredentialRef。
- GUI 布局、主题、语言和侧边栏偏好留在 localStorage；Workspace 当前目标引用在业务存储中按 Workspace 持久化。
- 通过 repository/storage ports 保留外部数据库适配口，首期不并列支持多种数据库运行模式。

## 后果

备份必须同时处理 SQLite 和 Artifact 目录；实现需要迁移和引用完整性检查。未来多用户或外部数据库可以复用 Workspace 边界，但需要新增身份和并发策略。

## 被否决方案

- 所有业务数据放 localStorage：无法支撑 Job、审计和大结果。
- 首期直接依赖外部 PostgreSQL/Redis：削弱桌面离线体验。
