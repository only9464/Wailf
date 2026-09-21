# 测试与发布

> 文档状态：`accepted`  
> 目标：让文档中的边界可以被后续实现验证，而不是停留在目录约定

## 1. 测试分层

### 1.1 领域单元测试

不启动 Wails、数据库或真实外部工具，覆盖：

- 目标输入、风险等级和拒绝原因；
- Job 状态转移、取消、重试和 `interrupted` 处理；
- Asset 归一化、去重和来源合并；
- Session 生命周期和可选 SessionChannel；
- 错误 code、脱敏和策略判断。

### 1.2 平台集成测试

使用临时 SQLite 和临时 Artifact 目录，覆盖：

- 迁移从空库到当前版本；
- 事务回滚、并发读取和分页；
- Job/Artifact/Audit 的关联一致性；
- Artifact 哈希、TTL、清理和恢复；
- 全局资产去重、任务/产物直接查询、策略变化后的历史可追溯性。

### 1.3 Connector 合同测试

每个 Connector 用 fake 外部进程或协议服务验证：

- 输入校验和参数映射；
- 超时、取消、部分结果和非零退出；
- 输出大小、编码和恶意字段限制；
- 诊断信息脱敏；
- 领域结果不依赖工具私有字段。

### 1.4 入口契约测试

- Wails DTO 与错误转换；
- CLI JSON schema、stdout/stderr 和退出码；
- MCP tool 输入限制、结构化输出和确认元数据；
- 未来 HTTP 的身份、Origin、限流和版本路径。

入口测试可以调用 fake 领域服务，但不能通过复制业务逻辑来“伪造成功”。

### 1.5 前端测试

- Shell、路由和浮层在桌面/窄窗口下的布局状态；
- layout JSON 导入、导出、迁移、未知项和恢复默认；
- store 对重复/乱序 Job 通知的幂等性；
- 每语言单一 JSON 路径、重复 key、双语叶子 key/插值一致性与 Element Plus locale 同步；
- Wails adapter 的取消、错误和 DTO 映射；
- 全局任务查询不需要项目；切换任务和筛选时旧响应不能覆盖；
- 平台卡片默认收起、向上展开、重复切换、操作后收起、Escape 焦点恢复、移动导航和草稿保留；
- Element Plus/shadcn-vue/Vue Bits token 一致性、popup 层级、键盘、深浅色和减少动画。

### 1.6 平台主题测试矩阵

主题测试必须同时覆盖入口边界、平台来源、级联层次和资源故障。主题只在 GUI 运行，CLI/MCP/HTTP 的测试应明确验证不会初始化或读取主题存储。

| 维度 | 最少场景 | 通过标准 |
| --- | --- | --- |
| `PlatformProvider` | `windows`、`darwin`、`linux`、`android`、`ios`、`web`、未知值；runtime 拒绝、异常和约 500 ms 超时 | 返回稳定 `PlatformDescriptor`，未知值为 `unknown`，不阻塞 AppShell |
| `ThemeStorage` | schema v1 正常读写、旧版本迁移、损坏 JSON、未知 `customId`、配额/隐私模式失败、ThemeBundle 导入/导出与 staging 恢复 | 只接受 allowlist token；bundle 全量校验、冲突不覆盖、失败原子回退，不写入秘密或任意 CSS |
| `ThemeService` | `base -> platform -> user` 级联、瞬时 runtime hook（focus/reduced-motion/forced-colors）、重复切换、删除活动主题、导入失败 | 顺序和清理幂等；平台 hook 保留，默认基底始终可用；不产生第四个持久化层 |
| token/hook | 新增语义 token、平台 token、`data-theme-base` 与 `data-platform` hook；对比度和 reduced-motion | 组件不依赖硬编码平台值，用户层不能改 selector、`url()`、`@import` 或脚本 |
| 资源与打包 | Vite `BASE_URL`、manifest/哈希、桌面包、移动包、资源 404/超时 | 资源来自随包 allowlist，路径在开发/生产一致；失败只回退主题 |
| GUI-only 边界 | CLI、MCP、HTTP/server 启动及并发运行 | 不访问 `wailf.ui.theme`，输出、领域状态、Job、审计不受主题影响 |
| runtime 版本 | Go Wails 与 `@wailsio/runtime` 的锁定版本、升级候选 | 两侧精确匹配 `v3.0.0-beta.20` 基线；禁止 `latest`，升级有 smoke 和回滚记录 |

当前 npm runtime 已精确锁定为 `3.0.0-beta.20`，与 Go 基线一致。构建前核对本机 CLI 和生成绑定；升级时所有运行时依赖一起验证，不能放宽为 latest。

发布目标应在 Windows 桌面、一个 Unix 桌面和移动 WebView/浏览器预览执行 smoke；未验证平台必须单列为未验证，模拟平台测试不算真机验收。资源加载失败、runtime 未就绪和存储损坏均必须可观测但不阻塞启动。详细契约见[主题与平台适配](../architecture/theme-and-platform.md)。

Windows Acrylic 需在构建后的原生窗口实际观察，记录系统版本、透明设置与可见效果；构建成功和浏览器截图不作为材质已生效的证明。自动化覆盖 `1000×618`、大屏、移动尺寸、草稿保留、组件库浮层和焦点。完成后执行前端测试、`npm run build`、`wails3 build`，不运行 `wails3 dev`。

## 2. 文档验证

每次文档基线变更都检查：

- Markdown 相对链接存在；
- fenced JSON 可以解析；
- Mermaid 图表语法保持简单、节点名称与正文一致；
- 12 个能力域、入口矩阵和术语表没有漏项；
- 已否决设计不会在新文档中被描述为推荐方案；
- ADR 状态、文档状态和路线阶段一致；
- 主题文档、ADR-0008、schema v1、runtime 锁定和资源路径的交叉链接一致。

仓库没有固定的 Markdown 工具时，可以先用脚本或编辑器检查；不要为了文档验证引入业务依赖。

## 3. 发布形态

| 形态 | 构建/运行 | 用途 | 约束 |
| --- | --- | --- | --- |
| Desktop GUI | Wails build/package | 本地界面 | 使用本地 SQLite、Artifact 目录和系统密钥库 |
| CLI | 同一主二进制 `wailf cli` | 脚本、CI、批处理 | 不读取 GUI localStorage |
| MCP | 同一主二进制 `wailf mcp` | 本机 AI 客户端 | 首期 stdio，工具集受控 |
| Server | 现有 `server` build profile | 受控无 GUI 部署 | TLS/来源校验完成前不作为远程控制面 |
| Docker | `task build:docker` | 可重复的 server 镜像 | 明确数据卷、Artifact 目录和密钥注入方式 |
| Mobile | Android/iOS Wails 工程 | 后续移动端体验 | 不假设桌面文件系统和系统密钥库完全相同 |

Desktop、Mobile 和浏览器预览都必须携带主题 manifest 与平台 hook 资源；浏览器预览只允许 `web`/测试 allowlist 平台，不得把预览值写入持久化平台偏好。

## 4. 数据迁移与备份

当前没有业务数据库，本轮是未发布模型修订，不执行旧数据合并迁移；以下约束适用于未来持久化实现。

- 数据库迁移必须有版本号、幂等检查、失败回滚和升级说明。
- 发布包启动时先执行兼容性检查，再打开业务入口。
- SQLite 文件和 Artifact 目录使用同一备份快照标识。
- 导入备份前校验 schema version、引用完整性、Artifact 哈希和路径安全。
- 备份中不包含可直接打印的秘密；恢复后通过 CredentialRef 重新验证密钥库引用。

## 5. 发布清单

1. 现行实现依据为 `accepted`，被替代 ADR 有明确替代关系；
2. 领域、入口、风险和数据保留策略有对应测试；
3. 生成绑定和构建产物来自同一版本；
4. 迁移、备份、回滚和清理路径经过演练；
5. 日志与错误不会泄露凭据或未脱敏会话输出；
6. 外部 Connector 版本、许可证和运行前提已记录；
7. GUI、CLI、MCP 的暴露矩阵与发布说明一致；
8. 主题 token/hook、资源 manifest、平台回退和 runtime 精确版本通过测试矩阵，且 ADR-0008 与[主题与平台适配](../architecture/theme-and-platform.md)状态为 `accepted`。
