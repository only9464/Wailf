# ADR-0003：Job 异步语义

- 状态：`accepted`
- 日期：2026-09-19

## 背景

扫描、导入、分析和外部工具调用可能持续很久，需要取消、进度、失败诊断和重启后的可解释状态。同步阻塞会冻结 GUI，也不适合 CLI 管道和 MCP。

## 决策

长操作默认返回 Job。Job 状态为 `queued`、`running`、`succeeded`、`failed`、`cancelled` 或 `interrupted`；进度以可持久化快照表达，结果通过领域记录和 Artifact 引用关联。

查询类操作可以同步返回。Job Runtime 是平台机制，不是统一 Capability 或 Engine 门面；具体 Job handler 由领域切片拥有。

进程异常退出时，未结束 Job 标记为 `interrupted`，默认不自动重扫；领域可以显式声明安全的恢复策略。

## 后果

入口需要提供 Job 查询/取消语义，前端需要处理乱序通知和刷新。测试必须覆盖取消、部分失败、重启和 Artifact 写入失败。

## 被否决方案

- 所有能力同步阻塞：不适合长任务和桌面交互。
- 一个全局事件流替代 Job 状态：无法保证可靠性和重放。
