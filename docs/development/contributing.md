# 开发与贡献

> 文档状态：`accepted`  
> 目标：让第一次加入项目的人可以在不猜架构的情况下找到正确的入口

## 1. 开始前

建议先阅读：

1. [产品需求基线](../product/requirements.md)；
2. [架构总览](../architecture/overview.md)；
3. 与任务相关的前端、后端或入口契约文档；
4. 若涉及 GUI 外观，先读[主题与平台适配](../architecture/theme-and-platform.md)；
5. 对应的 ADR 和 [安全与治理](../security/governance.md)。

当前仓库已有 Vue 界面、端口扫描页面、布局和主题管理；Go 业务仍为示例 `GreetService`，默认业务适配器未接入。不要把示例 service 当作未来领域架构。本轮只调整前端和文档，Go 仅适配 Windows Acrylic。

## 2. 本地环境

需要准备：

- Go 1.25；
- Node.js 与 npm（或 Taskfile 支持的其他前端包管理器）；
- Wails 3 CLI `v3.0.0-beta.20`；
- Windows/Linux/macOS 对应的 WebView 和原生构建依赖；
- 若运行 server/Docker 任务，还需要 Docker。

常用脚手架命令：

```text
task build
task package
task run:server
task build:docker
```

前端执行 `npm test`、`npm run build`，根目录执行 `wails3 build`；遵循 AGENTS.md，不运行 `wails3 dev`。命令的具体平台差异由根 `Taskfile.yml` 和 `build/*/Taskfile.yml` 管理。业务文档不应复制平台脚本细节，只引用任务名。

## 3. 新增一个能力域

按以下顺序工作：

1. 在产品基线中登记领域 ID、目标用户、风险等级和默认导航项；
2. 写领域边界：输入、输出、状态、外部依赖和不负责的内容；
3. 定义全局数据的查询与去重规则、风险策略和 Artifact/Audit 来源关联；
4. 在 `internal/features/<domain>` 内设计模型、查询、命令、Job handler 和领域专属端口；
5. 为需要的入口单独写 Wails、CLI、MCP 或 HTTP adapter；
6. 为前端在 `frontend/src/views/<功能分类>/` 添加页面，再补 feature route、注册元数据、store 和 i18n key；
7. 添加 fake connector、存储集成测试和入口契约测试；
8. 更新文档导航、入口暴露矩阵和相关 ADR。

业务规则只写在领域切片，入口 adapter 不得复制一份校验或直接操作 repository。

## 4. 新增一个 Connector

Connector 提交前必须写清：

- 支持的协议/工具版本和输入类型；
- 允许的风险等级、策略要求和资源上限；
- 超时、取消、重试和子进程清理；
- 外部结果到领域模型的映射；
- 凭据来源、日志脱敏和 Artifact 保留；
- 健康检查和 fake connector 行为。

不要接受任意 shell 字符串，也不要把外部工具的原始 JSON 当作公共 API。

## 5. 前端贡献规则

目录、语言包和组件库的唯一规则来源为[前端开发规范](frontend-conventions.md)。

- 页面通过 feature adapter/store 访问后端，不直接调用生成 bindings。
- 新文案先添加 i18n key，再写组件。
- 导航分组只修改布局数据或默认配置；路由页面放在 `views/<功能分类>/`，不在页面模板中复制 12 类树结构。
- localStorage 访问必须经过 `frontend/src/storage` 封装。
- 主区页面与全局浮层保持边界；TaskPanel/LogPanel 不持有领域规则。
- 主题由 `PlatformProvider`、`ThemeService` 和 `ThemeStorage` 负责，业务组件只消费语义 token 或 composable/hook，不直接探测操作系统或写平台选择器。
- 主题为 GUI-only；不要在 CLI、MCP 或 HTTP/server 代码中读取 `wailf.ui.theme`，也不要让主题值进入 DTO、Job、审计或日志。

### 5.1 新增 token 或平台 hook

按以下顺序提交：

1. 在主题 schema v1 清单登记语义名称、值类型、默认值、可覆盖范围、对比度和无障碍约束；
2. 先补 `base` 默认值，再按 `PlatformId`（`windows`、`darwin`、`linux`、`android`、`ios`、`web`、`unknown`）补平台 token；安全区、标题栏和拖拽等 chrome hook 使用独立的 `data-platform`，不可由用户主题覆盖；
3. 通过主题 composable/hook 使用 token，清理组件中的硬编码视觉值，并验证 `base -> platform -> user` 的层叠顺序；
4. 将 CSS/图片/字体等资源加入随包 manifest，使用 Vite `BASE_URL` 派生主题资源路径并补 404、哈希和版本校验；
5. 补 ThemeService/ThemeStorage 的迁移、损坏数据、配额、重复切换和回退测试，以及桌面/移动 smoke；最后更新主题文档和 ADR-0008。

## 6. 生成文件与依赖

- `frontend/bindings/` 是生成目录，不手工编辑。
- Wails 绑定变化必须通过生成命令产生，并在文档中注明对应 Go service 变更。
- `@wailsio/runtime` 必须与 Go Wails 精确锁定到同一基线（当前 `v3.0.0-beta.20`）；不要提交 `latest` 或只更新一侧版本。
- 平台主题资源必须由 Wails 打包，不能依赖开发服务器或网络路径；runtime/API 升级要同步更新资源 smoke、文档和 ADR-0008。
- 本轮 MCP SDK 未锁定；在 SDK 决策 ADR 通过前，不要让领域包导入具体 MCP 包。
- 引入依赖前说明用途、许可证、跨平台影响、升级策略和是否能放在 adapter 边界内。

## 7. 提交前检查

- 文档链接、JSON/Mermaid 示例和术语检查通过；
- 全局查询不依赖项目上下文，主动操作带风险提示、确认和审计说明；
- 没有新增全局 Capability/Engine/Event 抽象；
- 错误、取消、重启和部分失败路径有说明；
- 新入口明确 stdout/stderr、退出码或工具 schema；
- 测试使用 fake connector，不访问真实目标。
- 主题变更覆盖 token/hook 清单、GUI-only 边界、资源打包、runtime 锁定和平台回退测试。

## 8. 文档与 ADR

架构取舍、被否决方案或跨领域规则必须新增 ADR。普通实现细节写在领域文档，不把讨论过程塞进代码注释。文档状态从 `draft` 到 `designing` 再到 `accepted`，实现只能依赖 `accepted` 文档。

普通文档按 `docs/product/`、`architecture/`、`features/`、`development/`、`security/` 分类，文件名使用小写英文 kebab-case，正文保持中文；README 与编号 ADR 保留惯例。重命名时同步根 README、前端 README、文档导航和相对链接，不留两套正文。
