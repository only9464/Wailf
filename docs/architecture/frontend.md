# Wailf 前端架构

> 文档状态：`accepted`
> 技术基线：Vue 3、TypeScript、Vite、Vue Router、Pinia、JSON i18n、Wails 3

## 1. 目标与实现边界

前端提供轻量的安全工具界面。默认打开设置页，用户从设置中管理语言、主题、侧栏和功能布局；具体业务页面按功能分类放在 `frontend/src/views/` 下。业务后端仍为模板服务，未接入的查询和变更明确显示“服务尚未接入”。本文是前端实施与验收依据，不表示后端已实现。

文件与组件规则统一见[前端开发规范](../development/frontend-conventions.md)，避免在不同文档维护重复目录和语言包规则。

## 2. 技术与职责

| 层 | 职责 |
| --- | --- |
| Vue SFC / Router | 页面、布局、交互与稳定 hash route；默认 `/settings` |
| Pinia | Job 查询快照、通知、布局和运行时草稿 |
| JSON i18n | 应用语言包、变量插值、错误 key；同步 Element Plus locale |
| Element Plus | 业务表单、表格、分页、校验及反馈 |
| shadcn-vue | 导航、折叠区域、移动导航和全局浮层 |
| Vue Bits | 可关闭的少量装饰与进入动效 |
| 领域 service / adapter | 稳定前端类型、查询/变更接口、未来 Wails DTO 与错误转换 |
| storage / theme | GUI 偏好持久化、版本恢复、平台检测与受控 token |

组件只依赖 service/store，不直接导入生成 bindings。没有业务服务时使用未接入适配器；测试替身不得进入应用初始化。

## 3. Shell 与导航

```text
<App + ElConfigProvider>
└── <AppShell>
    ├── <Sidebar / MobileSheet>
    │   ├── <SearchAndNavigationControls>
    │   ├── <NavTree>
    │   └── <PlatformFooter>
    │       ├── <CollapsibleContent>  # 默认关闭，向上展开
    │       │   ├── 任务 -> TaskPanel
    │       │   └── 通知 -> NotificationPanel
    │       └── <PlatformCard>        # 始终位于底部
    ├── <MainArea / RouterView>
    └── <OverlayLayer>
        ├── <TaskPanel>
        └── <NotificationPanel>
```

- 侧栏顶部只保留功能搜索和导航控制，不显示 logo、产品名称、描述或上下文卡片。
- 默认路由为 `/settings`，设置页是软件启动后看到的第一个页面。
- 底部平台卡片读取现有 `PlatformProvider` 的已归一化描述符，显示 Windows、Linux、macOS、Android、iOS；普通浏览器显示“浏览器”，探测失败显示“未知平台”。不从 UA 猜测原生平台。
- “任务、通知”初始收起；平台卡片是唯一展开/收起触发器，点击后内容在卡片上方向上展开。抽屉参与侧栏布局，压缩导航滚动区，不覆盖路由主区；平台卡片始终可见。
- 展开状态仅保留本次运行，不写 localStorage。点击任一操作后收起；Escape 收起并恢复平台卡片焦点。触发器具有 `aria-expanded` 与内容关联。
- 窄窗口用 Sheet 展示导航，保留同样的平台卡片与折叠行为。关闭导航/浮层不销毁草稿。浮层互相切换时保持清晰焦点归属，内部弹出控件不得落在遮罩后。
- `OverlayLayer` 独立于路由。未来会话页面仍使用主区路由，不建立脱离主应用的窗口。

## 4. 页面目录与功能注册

所有路由页面放在 `frontend/src/views/` 下，并按功能分类建立目录；共享组件不能代替页面目录：

```text
frontend/src/views/
  settings/
    SettingsView.vue
  recon/
    PortScanView.vue
  asset/
    AssetListView.vue
  session/
    SessionListView.vue
```

新增功能时先在对应分类目录创建页面，再在路由和功能注册表中登记。页面目录使用小写 kebab-case，页面组件使用 PascalCase；同一功能的子页面、局部 composable 和测试就近放在该功能目录中。跨功能复用的组件放在 `components/`，不得把业务页面堆在根目录。

功能注册只包含稳定 `id`、`nameKey`、`icon`、`route`、`status`、`tags`，不包含运行时上下文。默认功能分组和入口由[产品需求基线](../product/requirements.md)的 JSON 给出，不在模板写死导航树。布局支持一级分组增删、排序、重命名，功能显隐、移动和排序，多布局切换，JSON 导入导出以及恢复默认。schema v1 校验版本、重复项和结构；未知功能 ID 保留在“未分配”，不静默删除；未知版本不能猜测迁移。导入失败保留上一个有效布局。

## 5. 状态与数据流

| 状态 | 内容 | 持久化边界 |
| --- | --- | --- |
| Job store | 全局 Job 列表、筛选、选中任务、进度及取消状态 | 后端为准；缓存查询快照 |
| Notification store | 真实界面通知、错误、未读数 | 运行时；不替代 AuditEntry |
| Layout / preference stores | 布局、语言、主题、侧栏宽度和折叠 | 经 storage 封装的 localStorage |
| Session store（未来） | 全局会话摘要、连接状态和选中通道 | 后端为准 |

业务 service 定义 `Job`、`Asset`、`Artifact`、`Connector` 等摘要及查询、提交、取消接口，不定义项目上下文参数。概念契约见[领域模型](domain-model-and-storage.md)和[入口契约](entry-contracts.md)。

查询需明确分页、筛选和排序；每次异步查询保留版本标记，切换任务、筛选或清空结果后，旧响应不得覆盖新状态。取消请求只有在服务成功并重新查询确认后才呈现终态；Job 固定六态。

Wails 事件只提示重新查询，不直接改写可靠业务事实。未来适配器转换 DTO 和错误 envelope；当前未接入时明确显示原因，保存、提交、取消和业务导出不可用。Connector 与 profile 列表等待真实服务，不编造可用工具；界面区分未接入、加载、无记录和失败。

## 6. 存储边界

localStorage 只保存布局与界面偏好，由 storage 模块集中管理版本、校验、导入导出和错误恢复：

```text
wailf.layout.<name>
wailf.layout.active
wailf.ui.theme
wailf.ui.theme.custom.<id>
wailf.ui.language
wailf.ui.sidebarWidth
wailf.ui.sidebarCollapsed
wailf.ui.layoutExportVersion
```

业务查询快照、目标输入和页面草稿不持久化到 GUI storage。平台卡片的抽屉展开状态也不持久化。主题的 staging/commit key 仅用于原子导入恢复，详见[主题契约](theme-and-platform.md)。

## 7. 平台与主题

`PlatformProvider` 只读取运行环境；`ThemeService` 按 `base → platform → user` 解析 token；`ThemeStorage` 处理 schema v1。主题是 GUI-only，CLI/MCP/HTTP 不初始化主题、不读取 GUI storage。

同步中性基底允许 AppShell 立即挂载，平台探测约 500 ms 超时、资源 404、存储损坏均不阻塞启动。资源随包分发，Wails Go/CLI/npm runtime 保持 beta.20 精确对齐。

Windows 保留系统标题栏，由 Go GUI 窗口启用原生 Acrylic；透明根背景是平台 hook，用户主题只为表面着色，不能用整页不透明背景盖住材质。Element Plus、shadcn-vue 的浮层/弹出控件共用 token；forced-colors 优先回退可读实色。其他平台保留兼容 hooks，本轮不扩展视觉方案。完整契约见[主题与平台适配](theme-and-platform.md)。

## 8. 验证

- 默认路由为 `/settings`；设置页和 52 个稳定入口在桌面、窄窗口和移动安全区均可到达，浮层不丢草稿。
- 平台映射、初始收起、向上展开、二次收起、操作后收起、Escape 与焦点恢复。
- 异步旧响应、重复通知、失败取消均不能误报成功。
- 语言文件组织、重复 key、双语叶子 key 与插值、Element Plus locale 同步。
- 布局导入导出、未知项、存储损坏恢复；主题层叠、原子导入、资源失败和减少动画。
- 三套组件主题、浮层层级、键盘和深浅色；Windows 原生 Acrylic 单独检查，不以浏览器预览替代。

关联决策：[全局数据模型](../adr/ADR-0009-global-application-data.md)、[UI 与文件规范](../adr/ADR-0010-frontend-ui-and-file-conventions.md)、[Windows Acrylic](../adr/ADR-0011-windows-acrylic-material.md)。
