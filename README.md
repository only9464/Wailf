# Wailf

Wailf 是面向安全工作的本地优先桌面平台，覆盖资产侦察、指纹识别、漏洞验证、会话管理、取证响应和威胁情报等能力域。项目使用 Wails 3 + Go + Vue 3；业务服务仍在接入阶段，前端默认明确显示“服务尚未接入”。

## 从哪里开始

- [文档导航](docs/README.md)：按角色选择阅读路径。
- [产品需求基线](docs/product/requirements.md)：产品边界、12 组/52 项功能基线。
- [架构总览](docs/architecture/overview.md)：运行模式、模块边界和依赖方向。
- [前端架构](docs/architecture/frontend.md)：设置入口、路由、状态、组件库和浮层。
- [前端开发规范](docs/development/frontend-conventions.md)：目录、单语言 JSON、Element Plus/shadcn-vue/Vue Bits 规则。
- [领域模型与持久化](docs/architecture/domain-model-and-storage.md)：应用级全局数据、Job、Asset 与 Artifact。
- [入口契约](docs/architecture/entry-contracts.md)：GUI、CLI、MCP 和未来 HTTP 的接口边界。
- [主题与平台适配](docs/architecture/theme-and-platform.md)：三层 token、平台资源和 Windows Acrylic。
- [端口扫描切片](docs/features/port-scan.md)：首个端到端流程设计。
- [安全与治理](docs/security/governance.md)：审计、秘密和数据保留策略。
- [开发与贡献](docs/development/contributing.md) / [测试与发布](docs/development/testing-and-release.md)。
- [ADR 索引](docs/adr/README.md)：当前决策及被替代历史决策。

## 当前工程基线

| 项目 | 约定 |
| --- | --- |
| 桌面壳 | Wails 3 `v3.0.0-beta.20` |
| 后端 | Go 1.25，模块化单体规划 |
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia |
| UI | Element Plus、shadcn-vue、Vue Bits，统一 Wailf token |
| 数据模型 | 本机单用户、应用级全局业务数据 |
| GUI 偏好 | 语言、布局、主题和侧栏偏好经 storage 模块写入 localStorage |
| 业务数据 | 规划使用 SQLite + 文件 Artifact Store + 系统密钥库；当前服务未接入 |

## 开发命令

```text
npm --prefix frontend ci
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
wails3 build
```

不要运行 `wails3 dev`。生成到 `frontend/bindings/` 的文件属于 Wails 构建产物，不手工编辑；runtime、Go 和 CLI 固定在 `v3.0.0-beta.20`。

## 数据与安全边界

全局任务、资产、产物和会话可直接查询；业务草稿、查询快照和界面通知不写入 localStorage。Wailf 聚焦资产分析、验证、会话管理、取证响应和威胁情报等工作流，不在文档中展开攻击载荷或绕过检测步骤。
