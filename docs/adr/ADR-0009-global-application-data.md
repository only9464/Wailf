# ADR-0009：应用级全局数据与独立授权范围

- 状态：`accepted`
- 日期：2026-09-20
- 替代： [ADR-0002](ADR-0002-Workspace与存储边界.md)

## 背景

Wailf 当前没有已发布业务数据库。继续把业务对象绑定到 Workspace 会让本机单用户应用保留一个不必要的项目容器，并把全局查询、授权范围和历史追溯混为一体。

## 决策

- 采用本机单用户、应用级全局数据模型；移除 Workspace 实体、字段、表、仓库、查询参数及入口命令，不设置隐藏的默认项目。
- Asset、Job、Artifact、Session 和 AuditEntry 可以直接查询。Asset 不按 Scope 分区，观测记录保存任务、来源和授权范围修订摘要。
- TargetScope 是独立全局授权记录。应用级策略定义上限，Scope 只能进一步限制主动操作；端口扫描等主动操作必须提交有效 Scope。
- 撤销或过期 Scope 阻止新的主动操作；按领域策略停止或降级运行任务/会话，但不删除历史 Job、Artifact、观测或审计。
- 由于没有现存业务数据库，本次只修改文档和未发布模型，不执行数据合并迁移。未来首次初始化直接建立无 Workspace 的结构。

## 后果

全局任务面板和资产查询不需要上下文切换；扫描页仍需明确选择授权范围。多用户或远程部署需要另行设计身份与访问策略，不能把 Scope 直接当作租户隔离。备份同时覆盖全局元数据、Artifact 和 Scope 修订，但不包含 GUI 草稿或秘密本体。

## 被否决方案

- 保留单一隐藏 Workspace：会让过时概念继续进入 DTO、查询和审计。
- 用 TargetScope 作为资产容器或租户边界：Scope 是授权条件，不能改变资产全局去重和历史追溯。

## 关联文档

[领域模型与持久化](../architecture/domain-model-and-storage.md)、[入口契约](../architecture/entry-contracts.md)、[端口扫描](../features/port-scan.md)、[安全与治理](../security/governance.md)。
