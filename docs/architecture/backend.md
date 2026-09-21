# Wailf 后端架构

> 文档状态：`accepted`  
> 技术基线：Go 1.25、Wails 3；首期为模块化单体

## 1. 组织原则

后端按能力域垂直切片，而不是按全局 `models/services/repositories/handlers` 横向堆叠。每个切片内部可以有自己的模型、查询、命令、Job handler、存储端口和外部连接器。

平台层只提供跨领域且已经验证为通用的机制：配置、数据库连接和迁移、Job 运行时、文件 Artifact、审计、秘密引用、日志和时钟。平台层不决定某个能力域如何执行。

## 2. 领域切片模板

一个领域切片可包含以下职责：

```text
features/recon/
  model.go                 # 领域对象和值对象
  queries.go               # 查询输入、输出和分页
  commands.go              # 变更输入和结果
  jobs.go                  # 该领域的长任务定义
  ports.go                 # 外部扫描器或存储端口
  service.go               # 用例编排和授权检查
  errors.go                # 稳定错误 code
```

并非每个目录都必须存在；切片应以领域边界为准，不为抽象而抽象。

## 3. 平台服务

### 3.1 Storage

Storage 提供应用级全局 repository ports、事务、迁移和分页能力。资产、任务、产物和会话不接受必填项目参数；TargetScope 是独立授权记录，应用级策略约束所有入口，Scope 可进一步收紧。Scope 的撤销不级联删除历史。默认实现使用 SQLite；外部数据库实现必须满足同一端口契约，不能让领域代码依赖 SQL 方言或具体驱动。

### 3.2 Job Runtime

Job Runtime 负责排队、运行、取消、进度快照、失败归档和进程重启标记。具体 Job handler 属于领域切片，平台运行时不理解扫描器参数或会话命令。

### 3.3 Artifact Store

Artifact Store 将大结果、日志、附件和导出文件写入文件系统或未来的对象存储，并在数据库保存元数据、内容哈希、大小、媒体类型、来源和保留策略。

### 3.4 Audit 与 Secrets

Audit writer 记录 actor、入口、目标、动作、结果及 Scope/Job 等关联；Secrets adapter 只负责系统密钥库和 credential reference，不把密钥传进普通日志或持久化 DTO。

## 4. 入口适配器

### Wails

Wails service 只做 DTO 转换、调用领域用例、返回可序列化结果和注册必要的界面通知。它不直接查询 SQLite，也不承担 CLI 的退出码语义。

### CLI

Cobra 命令负责参数解析、读取 stdin/文件、打印 JSON 或人类可读表格、映射退出码和处理信号。命令调用领域用例，不调用 Wails service。

### MCP

MCP adapter 负责工具描述、结构化输入校验、工具分组、确认元数据和 JSON 结果。SDK 被隔离在该目录；本轮不锁定 SDK，不让领域包导入 MCP 类型。

### HTTP

HTTP adapter 属于未来 server profile。它必须独立实现认证、TLS、来源检查、请求大小、并发和限流，不能因为复用 GUI 服务就默认暴露所有能力。

## 5. 连接器

外部扫描器、漏洞工具、C2 或 WebShell 系统都通过领域专属 Connector 接入。连接器需要提供：

- 能力/协议版本和健康状态；
- 输入校验、超时、取消和进程清理；
- 将外部输出转换成领域观测或 Session 通道数据；
- 不把原始凭据、命令行秘密或未授权目标写入普通日志；
- 可替换的 fake connector，便于测试。

Session connector 只统一生命周期、心跳、关闭、审计和可选通道声明。命令、文件、交互终端不是所有连接器都必须支持。

## 6. 错误、取消与日志

所有入口都使用稳定的机器可读错误 code；用户文案由前端或入口层根据 `messageKey` 翻译。错误至少包含是否可重试、关联 request/job ID 和安全 detail。

取消分为“请求取消”和“强制终止”：前者允许连接器清理并将 Job 标记为 `cancelled`，后者必须记录原因并保留清理失败信息。日志采用结构化字段，默认脱敏目标凭据、Authorization header、cookie、token 和会话输出。

## 7. 不允许的后端形态

- 全局 `Capability` 接口要求所有能力返回同一结构。
- `Engine.Submit` 作为所有领域的唯一入口。
- 用全局 Event bus 替代可靠的 Job、Session 和 Artifact 状态。
- 入口层直接操作 repository，绕过 TargetScope 或审计。
- 为了复用而让领域包导入 Wails、Cobra、MCP SDK 或 Vue 类型。
- 把外部工具的原始输出当作稳定领域模型直接暴露给所有入口。

## 8. 进程组装

composition root 按启动模式完成以下步骤：

1. 读取并校验配置；
2. 打开数据库、Artifact Store、密钥库和审计写入器；
3. 恢复未完成 Job 的 `interrupted` 标记并初始化运行时；
4. 创建领域服务和连接器注册表；
5. 根据模式注册 Wails service、CLI command、MCP tool 或 HTTP handler；
6. 在退出时停止新任务、关闭会话、刷新审计并关闭存储。

该流程是共享组装逻辑，不代表所有入口必须注册同一批服务。
