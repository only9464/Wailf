# ADR-0007：Vue 前端基线

- 状态：`partially superseded`
- 日期：2026-09-19
- 部分替代：[ADR-0010](ADR-0010-frontend-ui-and-file-conventions.md)（2026-09-20）

> 下文保留原始理由。Vue 3、TypeScript、Vite、Router、Pinia 及分层仍有效；暂不引入 UI 库的决定已由 ADR-0010 替代，现行目录与语言包规则见前端开发规范。

## 背景

仓库已经是 Vue 3 + TypeScript + Vite + Wails 绑定模板；产品需要路由化界面、可配置导航、全局浮层和多语言。

## 决策

沿用 Vue 3、TypeScript 和 Vite，补充 Vue Router、Pinia、i18n 和封装后的 localStorage。通用组件、领域页面、Wails adapter 和 stores 分层；不在本轮绑定某个重型 UI 组件库。

## 后果

可以保留现有开发工具和生成绑定流程，逐步替换模板页面。组件库或视觉系统未来可以在通用组件层引入，不应让领域页面直接依赖供应商组件的业务语义。

## 被否决方案

- 迁移 React：当前没有足够收益抵消模板和绑定迁移成本。
- 直接用重型组件库定义所有领域交互：会锁定视觉和跨端约束。
