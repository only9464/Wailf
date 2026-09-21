# ADR-0010：前端 UI 技术栈与文件规范

- 状态：`accepted`
- 日期：2026-09-20
- 部分替代：[ADR-0007](ADR-0007-Vue前端基线.md)

## 背景

前端需要稳定的业务表单、表格和验证控件，同时保留可组合的导航、浮层和移动抽屉。语言包分散在多个文件会造成重复 key 与双语缺失；目录缺少唯一规范会让领域代码和生成组件边界模糊。

## 决策

- Element Plus 负责业务表单、表格、分页、日期、校验和反馈；按需引入并通过 ConfigProvider 同步语言。
- shadcn-vue 源码放在 `components/ui/`，负责侧栏、Collapsible、Sheet 和导航浮层；业务逻辑由组合组件持有。
- Vue Bits 仅用于 `components/effects/` 中少量非必要装饰/进入动效，遵循减少动画偏好；依赖来源、版本和许可证写入前端说明。
- 每种语言使用 `i18n/<locale>/<locale>.json` 的单一应用 JSON，嵌套命名空间承载所有应用文案。Element Plus 自带文案只通过 ConfigProvider 提供。
- 目录、命名、localStorage 边界、组件 token 和按需引入规则以[前端开发规范](../development/frontend-conventions.md)为唯一来源。

## 后果

业务控件统一获得可访问性和校验行为；导航与业务控件由不同层负责，减少领域耦合。引入三套来源需要统一语义 token、焦点/浮层层级和 Tailwind reset，且必须记录依赖锁定版本与许可证。

## 被否决方案

- 继续使用散落的原生控件作为业务表单基线。
- 让领域组件直接依赖 shadcn-vue 源码状态或把 Vue Bits 动效用于进度、错误和授权结果。
- 为每种语言拆分多份应用 JSON。

## 关联文档

[前端架构](../architecture/frontend.md)、[前端开发规范](../development/frontend-conventions.md)、[前端开发说明](../../frontend/README.md)。
