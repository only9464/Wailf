# Wailf 产品需求基线

> 文档状态：`accepted`（需求与架构基线）  
> 基线版本：`0.2`  
> 修订日期：2026-09-20  
> 适用对象：项目负责人、合作开发者、新贡献者

本文档是产品范围和产品语言的基线。实现细节分别记录在 [架构总览](../architecture/overview.md)、[后端架构](../architecture/backend.md)、[领域模型与持久化](../architecture/domain-model-and-storage.md)、[主题与平台适配](../architecture/theme-and-platform.md) 和各项 ADR 中。

## 1. 产品定位

Wailf 是一个面向安全工作的综合安全操作平台，而不是单一扫描器。扫描、指纹和漏洞验证是首批能力域；平台长期还要承载会话、产物、取证、响应和威胁情报等持续工作流。

### 1.1 目标

- 在一个可配置的界面内管理目标、资产、任务、产物和会话。
- 让 GUI、CLI 和 MCP 按各自适合的方式暴露能力，避免为了“统一”而牺牲入口体验。
- 让新能力可以以独立领域切片加入，并复用存储、任务、审计和秘密管理等平台基础设施。
- 默认支持离线和本地运行，并为未来的无 GUI server 模式和外部数据库保留边界。

### 1.2 非目标

- 首期不设计完整多租户、团队 RBAC 或云端控制平面。
- 首期不自研 C2 Agent、载荷生成器或 WebShell 植入方式。
- 不把所有能力强行包装成一个通用 `Capability` 接口、统一 `Engine.Submit` 门面或全局事件流。
- 不把 GUI 布局配置、扫描结果和大体积日志混存到同一个 localStorage 空间。
- 不在产品文档中展开攻击载荷、绕过检测或植入步骤。

## 2. 用户与工作边界

首期面向本机单用户，所有业务数据由应用全局管理。取消业务项目概念，不要求创建或选择数据容器，不设隐藏的默认项目。资产、任务、产物和会话可直接查询；未来多用户需要重新设计身份与访问策略。

扫描、验证、连接和命令执行都直接使用目标与功能参数，页面不额外引入上下文容器。

## 3. 能力域地图

能力域是产品规划和默认导航的分组，不是固定的 UI 树，也不是后端统一接口。功能登记自己的元数据，分组由可导入/导出的布局配置决定。

| ID | 能力域 | 典型内容 | 首期状态 |
| --- | --- | --- | --- |
| `recon` | 侦察与信息收集 | 端口扫描、服务识别、子域、DNS/Whois、存活探测、OSINT | `designing` |
| `asset` | 指纹与资产测绘 | Web/服务指纹、CMS 识别、资产聚合去重 | `planned` |
| `vuln` | 漏洞发现与验证 | POC、Nuclei/Afrog/Xray 联动、目录扫描、配置检测 | `planned` |
| `auth` | 口令与认证攻击 | 弱口令、哈希、Kerberos、JWT/Session 分析 | `planned` |
| `exploit` | 利用与环境验证 | 外部 Exploit 框架、本地配置验证、容器安全检查 | `planned` |
| `post` | 后渗透与横向移动 | 内网扫描、AD 评估、凭证风险分析 | `planned` |
| `c2` | C2 与连接维持 | 外部 C2 连接器、Agent/信道状态、持久化风险 | `planned` |
| `webshell` | WebShell 与会话管理 | 外部 WebShell 连接器、命令/文件/终端通道 | `planned` |
| `cloud` | 云与容器 | 云资产、AK/SK 泄露、配置审计、K8s 安全 | `planned` |
| `toolbox` | 工具箱 | 编解码、加解密、国密、哈希/JWT、格式转换、代理 | `planned` |
| `forensics` | 取证与响应 | 日志、内存、pcap、应急响应工作流 | `planned` |
| `intel` | 威胁情报 | IOC 查询、情报聚合 | `planned` |

### 3.1 能力域边界与入口基线

下表是产品阶段的逐域基线，不是要求首期一次性实现全部入口。`owner` 表示领域规则、模型和用例的所有权；`default group` 必须能在 4.2 的布局 JSON 中找到同名分组和至少一个功能项。入口值含义为：`full` 完整工作流、`subset` 受控子集、`planned` 已规划未开放、`closed` 首期默认关闭、`future` 预留。首个切片完成前，只有 `recon` 的端口扫描子集具有实现优先级。

| ID | 领域 owner 与不负责内容 | default group | GUI | CLI | MCP | HTTP |
| --- | --- | --- | --- | --- | --- | --- |
| `recon` | 侦察查询、扫描 Job、扫描器 Connector；不拥有通用 Job runtime | `recon` | `full` | `subset`（端口扫描） | `subset`（任务/摘要） | `future` |
| `asset` | 资产归一化、指纹和去重；不拥有原始扫描器进程 | `asset` | `planned` | `planned` | `planned` | `future` |
| `vuln` | 漏洞发现、验证记录和 finding 生命周期；不提供攻击载荷 | `vuln` | `planned` | `closed` | `closed` | `future` |
| `auth` | 认证材料分析和风险结果；不保存明文凭据 | `auth` | `planned` | `closed` | `closed` | `future` |
| `exploit` | 外部验证 Connector 和结果归一化；不自研或分发攻击载荷 | `exploit` | `planned` | `closed` | `closed` | `future` |
| `post` | 后渗透评估、横向风险和结果归档；不拥有 C2 Agent | `post` | `planned` | `closed` | `closed` | `future` |
| `c2` | 外部 C2 Connector、Session 元数据和审计；不实现自研 Agent | `c2` | `planned` | `closed` | `closed` | `future` |
| `webshell` | 外部 WebShell Connector、Session channel 和审计；不生成植入代码 | `webshell` | `planned` | `closed` | `closed` | `future` |
| `cloud` | 云/Kubernetes 资产和配置审计；不持有长期云密钥 | `cloud` | `planned` | `planned` | `subset`（查询） | `future` |
| `toolbox` | 本地编解码、格式转换和分析工具；不隐式改变业务数据 | `toolbox` | `planned` | `subset` | `subset`（无副作用查询） | `future` |
| `forensics` | 日志、内存、pcap 和响应工作流；不绕过 Artifact 保留策略 | `forensics` | `planned` | `planned` | `subset`（查询） | `future` |
| `intel` | IOC 查询和情报聚合；保留来源和时间信息 | `intel` | `planned` | `subset` | `subset`（查询） | `future` |

入口状态可以随单项能力变更，但必须同时更新本表、4.2 默认布局、[入口契约](../architecture/entry-contracts.md)的矩阵和对应 ADR；不能因为新增一个入口适配器就扩大领域 owner 的职责。

### 3.2 横向标签

功能可以拥有多个筛选标签，但标签不改变能力域归属：

`Web` `主机` `网络设备` `数据库` `云` `容器` `移动` `无线` `工控`

### 3.3 首个垂直切片

首个深入设计和实现验证的切片是“资产侦察与端口扫描”。它覆盖目标范围、Asset 归一化、Job 生命周期、扫描器连接器、Artifact 归档、GUI/CLI/MCP 适配和审计，是后续能力域的参考样板。

## 4. 默认导航与功能注册

### 4.1 功能注册元数据

功能只登记自己的稳定元数据，不登记分组：

```json
{
  "id": "portscan",
  "nameKey": "screen.portscan.title",
  "icon": "radar",
  "route": "/recon/portscan",
  "status": "designing",
  "tags": ["网络设备", "主机"]
}
```

### 4.2 默认分组配置

分组配置使用 i18n key，支持用户排序、隐藏、移动、增删一级分组，以及多套布局切换。导入时必须校验版本、重复项和未知功能 ID；未知 ID 可以保留在“未分配”区，不得静默丢失。

```json
{
  "version": 1,
  "layoutId": "default",
  "groups": [
    {
      "id": "recon",
      "name": "nav.group.recon",
      "icon": "radar",
      "items": ["portscan", "service-identification", "subdomain", "dns-whois", "liveness", "osint"]
    },
    {
      "id": "asset",
      "name": "nav.group.asset",
      "icon": "boxes",
      "items": ["web-fingerprint", "component-fingerprint", "cms-identification", "asset-dedup"]
    },
    {
      "id": "vuln",
      "name": "nav.group.vuln",
      "icon": "shield-alert",
      "items": ["poc-scan", "nuclei", "afrog", "xray", "directory-scan", "access-control-check"]
    },
    {
      "id": "auth",
      "name": "nav.group.auth",
      "icon": "key-round",
      "items": ["weak-credential", "hash-analysis", "kerberos-audit", "jwt-session"]
    },
    {
      "id": "exploit",
      "name": "nav.group.exploit",
      "icon": "crosshair",
      "items": ["exploit-connector", "web-validation", "local-privesc", "container-escape"]
    },
    {
      "id": "post",
      "name": "nav.group.post",
      "icon": "network",
      "items": ["internal-scan", "lateral-assessment", "ad-assessment", "credential-risk"]
    },
    {
      "id": "c2",
      "name": "nav.group.c2",
      "icon": "radio-tower",
      "items": ["c2-connector", "agent-state", "channel-state", "persistence-review"]
    },
    {
      "id": "webshell",
      "name": "nav.group.webshell",
      "icon": "terminal",
      "items": ["webshell-connector", "session-terminal", "session-files"]
    },
    {
      "id": "cloud",
      "name": "nav.group.cloud",
      "icon": "cloud",
      "items": ["cloud-discovery", "credential-leak", "cloud-audit", "k8s-security"]
    },
    {
      "id": "toolbox",
      "name": "nav.group.toolbox",
      "icon": "wrench",
      "items": ["codec", "crypto", "guomi", "hash-jwt", "format-convert", "proxy-tunnel", "text-tools"]
    },
    {
      "id": "forensics",
      "name": "nav.group.forensics",
      "icon": "microscope",
      "items": ["log-analysis", "memory-forensics", "pcap-analysis", "incident-response"]
    },
    {
      "id": "intel",
      "name": "nav.group.intel",
      "icon": "radar",
      "items": ["ioc-query", "intel-aggregation"]
    }
  ]
}
```

## 5. 三入口原则

| 入口 | 首期定位 | 暴露原则 |
| --- | --- | --- |
| Wails GUI | 主界面 | 负责可视化、交互式配置、任务和会话面板 |
| `wailf cli` | 脚本与 CI | 只暴露适合批处理、管道和稳定退出码的子集 |
| `wailf mcp` | AI Agent 适配 | 以任务级和查询级工具聚合，控制在 15 至 25 个工具 |
| HTTP server | 未来部署形态 | 复用领域能力但独立处理认证、TLS、来源和并发 |

三入口共享领域模型、存储和核心算法，但不共享统一门面或对称接口。某项能力需要几个入口，就为这几个入口分别编写适配层；业务规则只能有一份。

## 6. 多语言与 GUI 配置

- 语言包目录与每语言单一 JSON 规则统一遵循[前端开发规范](../development/frontend-conventions.md)。
- 所有 UI 文案、后端错误 key、POC/字典名称都走 i18n；禁止硬编码和句子拼接。
- GUI 布局、主题、语言、侧边栏状态等使用封装后的 localStorage 模块。
- 目标输入和未提交表单只保留运行时草稿；已提交业务记录由后端全局持久化，敏感值只保存引用或脱敏摘要。
- localStorage 只保存 GUI 专属偏好，不保存扫描结果、会话原始输出或凭据。

### 6.1 平台主题基线

- 主题是 GUI-only 的平台适配能力，由 `PlatformProvider`、`ThemeService` 和 `ThemeStorage` 协作；CLI、MCP、HTTP/server 不读取主题偏好。
- 主题 schema 固定为 v1，平台 ID 覆盖 `windows`、`darwin`、`linux`、`android`、`ios`、`web` 和 `unknown`；平台 token 与平台 chrome hook 分离，用户主题只能覆盖受控语义 token。
- GUI 启动先使用默认基底，再异步探测平台、加载随包资源和恢复用户主题；runtime 探测、资源 404、损坏存储或解析失败都回退到可用默认值，不阻塞 AppShell。
- 新 token/hook 必须登记清单、默认值、平台覆盖和 composable/hook 用法，并补充资源打包、迁移和跨平台测试；详细流程见[主题与平台适配](../architecture/theme-and-platform.md)。
- `@wailsio/runtime` 与 Go Wails 版本精确锁定，当前基线为 `v3.0.0-beta.20`；升级需要同步 ADR、主题资源 smoke 和发布记录。

### 6.2 导航与 Windows 材质

侧栏顶部仅保留搜索和导航控制；默认路由为 `/settings`，设置页是软件启动后的第一个页面。左下运行平台卡片默认收起任务和通知，点击后在卡片上方向上展开。Windows 保留原生标题栏与按钮，使用全局 Acrylic；其他平台本轮只保留兼容能力。具体交互见[前端架构](../architecture/frontend.md)，材质见[ADR-0011](../adr/ADR-0011-windows-acrylic-material.md)。

## 7. 运行、数据与安全基线

- 本地默认使用 SQLite 保存元数据，文件系统保存大结果、日志和附件；外部数据库只通过存储端口接入。
- 长操作默认 Job 化，支持状态、进度、取消、失败原因和 Artifact 引用。
- Session 统一生命周期和心跳；命令、文件、交互终端是连接器声明的可选通道。
- 凭据进入操作系统密钥库，数据库只保存引用；高风险操作保留确认和审计记录。
- C2/WebShell 首期只设计外部连接器，不设计自研 Agent 或植入载荷。

## 8. 决策状态索引

| 主题 | 状态 | 记录 |
| --- | --- | --- |
| 模块化单体与入口适配 | 已接受 | [ADR-0001](../adr/ADR-0001-模块化单体与入口适配.md) |
| 应用级全局数据与存储边界 | 已接受 | [ADR-0009](../adr/ADR-0009-global-application-data.md) |
| Job 默认异步、可取消和中断标记 | 已接受 | [ADR-0003](../adr/ADR-0003-Job异步语义.md) |
| C2/WebShell 外部 Session Connector | 已接受 | [ADR-0004](../adr/ADR-0004-会话连接器边界.md) |
| MCP 首期 stdio | 已接受 | [ADR-0005](../adr/ADR-0005-MCP传输与SDK待定.md) |
| MCP SDK 具体选型 | 明确延期 | [ADR-0005](../adr/ADR-0005-MCP传输与SDK待定.md) |
| 入口不对称，不设统一 Capability/Engine/Event 门面 | 已接受 | [ADR-0006](../adr/ADR-0006-入口不对称与不设统一门面.md) |
| Vue 3 + TypeScript + Vite、组件库与文件规范 | 已接受 | [ADR-0010](../adr/ADR-0010-frontend-ui-and-file-conventions.md)，部分替代 ADR-0007 |
| 平台主题与用户主题分层、GUI-only | 已接受 | [ADR-0008](../adr/ADR-0008-平台主题与用户主题分层.md)；[主题与平台适配](../architecture/theme-and-platform.md) |
| Windows 原生 Acrylic、全局透明表面与回退 | 已接受 | [ADR-0011](../adr/ADR-0011-windows-acrylic-material.md) |

## 9. 版本状态与后续路线

| 阶段 | 目标 | 验收信号 |
| --- | --- | --- |
| `0.1` 文档基线 | 需求、架构、契约、治理完整且无冲突 | 新贡献者可沿文档定位一次功能新增路径 |
| `0.2` 平台骨架 | 全局数据、SQLite、Job、Artifact、审计、GUI Shell 和主题基底 | 可查询全局任务，平台探测失败仍正常启动 |
| `0.3` 首个切片 | 资产侦察与端口扫描闭环 | GUI/CLI/MCP 各自完成约定子集 |
| `0.4+` 能力扩展 | 指纹、漏洞、取证、情报和外部会话连接器 | 每个领域有独立契约和适配测试 |

本文档不承诺具体工具版本、扫描器实现或 MCP SDK。相关选择必须通过 ADR 更新。
