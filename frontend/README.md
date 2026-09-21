# Wailf 前端工作台

Vue 3 / TypeScript / Vite / Wails 3 前端。实现 12 组、52 个功能入口和端口扫描工作台流程；默认路由为 `/recon/portscan`。业务 Go 服务尚未接入，不生成演示任务、资产、Connector 或扫描结果。

## 当前界面

- 无品牌/产品名/项目卡片的侧栏；左下平台卡片显示 Windows、Linux、macOS、Android、iOS、浏览器或未知平台。
- 平台卡片默认收起任务、通知、设置抽屉；点击向上展开，再次点击或 Escape 收起，操作后恢复焦点。
- 扫描页管理独立 TargetScope，编辑目标和表单草稿；全局任务、资产、服务、产物和审计视图区分未接入、加载、无记录和失败。
- 保存、提交、取消和业务导出在服务未接入时不可用并说明原因；业务草稿仅保留当前运行期间。
- `/settings` 提供语言、主题、侧栏和布局编辑：分组增删改名排序、功能显隐/移动、多布局、JSON 导入导出、未知功能保留及恢复默认。

## 目录与接入点

| 位置 | 职责 |
| --- | --- |
| `src/components/AppShell.vue` | 导航、平台抽屉和全局浮层 |
| `src/components/ui/` | shadcn-vue 源码，无业务状态 |
| `src/components/effects/` | Vue Bits 非必要装饰/进入动效，遵循减少动画 |
| `src/features/registry.ts` | 52 项功能元数据和默认布局 |
| `src/services/{types,index}.ts` | 全局 Scope/Job/Asset/Artifact/Connector 类型、领域端口与未接入适配器 |
| `src/stores/` | 全局 Scope、Job、偏好、布局和界面通知 |
| `src/storage/` | 唯一 localStorage 访问层；不保存业务草稿 |
| `src/theme/` | PlatformProvider、ThemeService、ThemeStorage、三层 token 和资源回退 |
| `src/i18n/` | `zh-CN/zh-CN.json`、`en-US/en-US.json` 两个单一应用语言文件 |

未来 Wails adapter 在 `src/services/` 中把生成 DTO 映射到前端类型，并在创建 stores 前调用 `configureServices()`。页面只依赖 service/store，不导入生成 bindings；当前默认 adapter 返回 `service.unavailable`。查询列表不需要项目或 Scope，主动扫描请求保留 `targetScopeId`。事件只提示重新查询，stores 通过请求序号拒绝过期响应。

## 依赖与样式

Element Plus 负责业务表单、表格、分页、日期、校验和反馈；shadcn-vue 负责侧栏、Collapsible、Sheet 和导航浮层；Vue Bits 仅提供少量装饰/进入动效。组件库版本、来源与许可证见 `package.json` 和本说明维护记录；所有组件映射 Wailf 语义 token。Tailwind 基础样式不启用会破坏 Element Plus 的全局 reset。

Windows 使用原生标题栏和系统按钮，Go 窗口启用 Acrylic；前端根背景与浮层使用受控透明表面。浏览器预览不能证明原生材质生效，需在 Windows 构建窗口检查。

## 运行与验证

在 `frontend/` 执行：

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Playwright 验收使用构建后的静态产物，不启动 Wails 开发模式：

```powershell
npx playwright install chromium
npm run build
npm run test:e2e
```

在项目根目录执行 Windows 桌面构建：

```powershell
wails3 build
```

遵循仓库约定，不运行 `wails3 dev`。浏览器截图与构建成功不作为 Acrylic 生效证明；其他平台状态需如实记录。
