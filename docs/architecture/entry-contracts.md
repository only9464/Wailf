# 入口契约

> 文档状态：`accepted`  
> 原则：共享领域规则，入口协议各自负责

## 1. 共同线

入口适配器都必须遵守以下语义，但不要求 wire format 相同：

- ID 是不透明字符串；时间是 UTC RFC 3339。
- 长操作返回 Job 标识或 Job 摘要，不在请求线程中等待完整扫描。
- 查询直接面向应用级全局数据，不要求项目或 Scope；主动扫描、连接等操作必须带有效 TargetScope 和确认信息，并接受应用级策略校验。
- 错误包含稳定 `code`、可翻译的 `messageKey`、安全 `detail`、关联 ID 和 `retryable`。
- 列表接口使用明确的筛选、排序和分页语义，不返回无界数组。
- 领域对象的版本与入口协议版本分开；入口可以只暴露领域对象的子集。

概念错误 envelope：

```json
{
  "code": "scope.expired",
  "messageKey": "error.scope.expired",
  "detail": {"scopeId": "scope_opaque_id"},
  "requestId": "req_opaque_id",
  "retryable": false
}
```

## 2. Wails GUI

Wails adapter 以 Go service 方法作为 GUI 的本地 RPC：

- 输入和输出使用稳定 DTO，避免把数据库行或第三方工具结构直接暴露给前端。
- 生成的 TypeScript bindings 只由 Wails 生成；前端通过 feature adapter 调用。
- Job、Session 和通知的实时变化可以用 Wails 事件提示刷新，但后端查询是事实来源。
- 取消操作必须有显式方法或 cancellable context，不能依赖页面销毁来取消。
- Wails 方法错误统一转换为上面的 error envelope；前端根据 key 翻译。

GUI 不需要为了与 CLI/MCP 相同而使用 JSON 字符串；类型化绑定优先保证编译期检查和 IDE 体验。

### 2.1 查询、变更与事件边界

列表通过筛选、分页和排序访问全局数据；详情通过 `jobId`、`assetId`、`artifactId` 或 `sessionId` 查询。扫描提交保留 `targetScopeId`，取消通过 `jobId` 发起并校验应用策略。撤销 Scope 不删除历史查询结果。

概念事件提示只携带定位信息，例如 `{ "jobId": "job_opaque_id" }`；GUI 收到后重新查询。切换任务、筛选或授权范围时，旧响应不得覆盖当前状态。错误和事件都不增加项目标识字段。

这些示例是设计约定，不等同于已发布的 Wails 方法、CLI 命令或 MCP 工具。当前业务适配器返回 `service.unavailable`，不能用空结果伪装已接入。

## 3. CLI

CLI 运行形态为：

```text
wailf cli <command> [flags]
```

约定：

- `--output json` 输出机器可读 JSON；默认输出适合终端阅读的表格或摘要。
- stdout 只放结果，stderr 放诊断、进度和警告，便于管道使用。
- 退出码表达整体结果，不把业务错误文本当作协议：

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功 |
| `2` | 参数或输入无效 |
| `3` | 授权范围、凭据或策略拒绝 |
| `4` | Job/连接器/外部工具执行失败 |
| `5` | 存储、配置或内部错误 |

- 长任务默认返回 Job 摘要，并提供 `job get`、`job wait`、`job cancel` 等查询/控制子命令。
- CLI 不启动 GUI、不调用 Wails service，也不读取 GUI localStorage。

首期 CLI 暴露候选子集：TargetScope 管理、资产查询与导出、端口扫描 Job、Job 查询/取消和 Artifact 导出。交互式 Session 控制不作为首期默认命令。

## 4. MCP

`wailf mcp` 首期使用 stdio。MCP SDK 在本轮保持未锁定，适配层只依赖自己定义的工具注册和领域转换边界；SDK 选择必须满足 stdio、结构化输出、取消、工具注解和未来 Streamable HTTP 的兼容要求。

工具按任务和查询聚合，目标控制在 15 至 25 个，不为每个内部函数创建工具。候选分组如下：

| 分组 | 例子 | 风险 |
| --- | --- | --- |
| TargetScope | `scope_list`、`scope_get` | 低 |
| Asset | `asset_search`、`asset_get`、`asset_export` | 低 |
| Job | `job_start`、`job_get`、`job_list`、`job_cancel` | 中 |
| Recon | `recon_portscan_start`、`recon_result_summary` | 中/高 |
| Artifact | `artifact_get`、`artifact_export` | 中 |
| Session | `session_list`、`session_get` | 低/中 |

工具输入按操作声明 TargetScope、确认和输出大小限制。全局查询不需要 Scope；主动操作必须显式提供有效 Scope。危险动作默认拒绝或要求明确确认；MCP 不默认暴露原始 C2/WebShell 命令执行。

Wails 自带的 UI 控制型 MCP（如果开发模式启用）与产品能力 MCP 是两条不同边界：前者只用于开发/测试，不能成为产品领域工具面。

## 5. HTTP server（预留）

未来 HTTP adapter 可以复用领域用例，但必须重新定义：

- 身份认证、应用级访问策略和审计 actor；
- TLS、Host/Origin 校验、CSRF、请求大小和速率限制；
- Job 查询和流式通知的生命周期；
- 外部数据库并发和多实例一致性。

在这些条件未完成前，server 模式只能作为开发或受控本地部署，不宣传为安全的远程控制面。

## 6. 入口暴露矩阵

| 能力 | GUI | CLI | MCP | HTTP |
| --- | --- | --- | --- | --- |
| TargetScope | 管理与选择 | 管理子集 | 查询子集 | 未来 |
| 资产查询/导出 | 完整 | 稳定 JSON | 查询工具 | 未来 |
| 端口扫描 Job | 启动/查看/取消 | 启动/查看/取消 | 任务级工具 | 未来 |
| 原始大 Artifact | 预览/导出 | 导出路径 | 限制大小或引用 | 未来 |
| C2/WebShell | 未来主区 | 默认关闭 | 默认关闭 | 未定 |
| GUI 布局 localStorage | 完整 | 不读取 | 不读取 | 不读取 |
| GUI 主题 localStorage | 完整 | 不读取 | 不读取 | 不读取 |

矩阵是产品选择，不是要求每个领域都填满；新增能力必须说明为什么暴露或不暴露。

## 7. 兼容性与版本

- Wails binding 的兼容性由 Go service 与前端共同发布，不承诺独立的公共 API 版本。
- CLI JSON 输出一旦公开，增加字段必须向后兼容；破坏性变更提升 schema version 或命令版本。
- MCP 工具名称和输入 schema 变更必须有迁移说明；删除工具前至少保留一个弃用周期。
- HTTP 未来采用独立 `/api/v1` 版本，不把 Wails 方法名直接作为公共 URL。
