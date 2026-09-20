# ADR-0011：Windows 原生 Acrylic 材质

- 状态：`accepted`
- 日期：2026-09-20

## 背景

Windows 桌面需要全局 Acrylic，同时保留系统标题栏和窗口按钮。逐层 CSS 模糊无法等价模拟 DWM 材质，也会给跨平台回退带来不一致。

## 决策

- 在 Windows Wails 窗口使用 `BackgroundTypeTranslucent` 与 `application.Acrylic`（`BackdropType: 3`），保留原生标题栏和按钮。
- 根 WebView 背景保持透明；侧栏、主区、页头、底部抽屉和浮层使用受控半透明语义 surface，让 DWM 材质透出。用户主题只改变 surface tint，不以整页不透明背景覆盖材质。
- Windows 11 22621+ 使用原生系统材质；旧系统由 Wails/框架提供兼容模糊；系统关闭透明或高对比模式时回退可读实色。其他平台保留现有兼容 hooks，本轮不扩展视觉设计。
- 不使用逐层 CSS blur 伪装 Acrylic。浏览器截图和构建成功不能证明原生材质生效，必须在 Windows 构建窗口中检查。

## 后果

组件 token、Element Plus 和 shadcn-vue 浮层必须允许透明背景并保持对比度；强制色模式需要实色回退。原生效果属于 Go 窗口适配，前端不能假设 WebView 本身能检测 DWM 是否启用。

## 被否决方案

- 将窗口设为无边框并自行绘制标题栏按钮。
- 用 CSS `backdrop-filter` 在每个区域单独模拟 Acrylic。

## 关联文档

[主题与平台适配](../architecture/theme-and-platform.md)、[前端架构](../architecture/frontend.md)、Microsoft [DWM_SYSTEMBACKDROP_TYPE](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type)。
