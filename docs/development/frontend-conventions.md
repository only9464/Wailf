# 前端开发规范

> 文档状态：`accepted`  
> 适用范围：Vue 3 / TypeScript / Vite / Wails GUI  
> 决策：[ADR-0010](../adr/ADR-0010-frontend-ui-and-file-conventions.md)

本文件是前端目录、组件来源和语言包组织规则的唯一规范来源。架构与交互见[前端架构](../architecture/frontend.md)，token 与平台行为见[主题与平台适配](../architecture/theme-and-platform.md)。规范描述目标约束；服务接入和原生效果的实际验证状态以[前端开发说明](../../frontend/README.md)和本次构建记录为准。

## 1. 目录与命名

```text
frontend/src/
  App.vue                     # 根布局、全局 provider
  main.ts                     # Vue 初始化
  router.ts                   # hash 路由
  components/
    ui/                       # shadcn-vue 源码；无业务状态或服务调用
    effects/                  # Vue Bits 装饰/进入动效及来源说明
    *.vue                     # 共享组合组件、导航和独立浮层
  features/                   # 功能注册和默认布局
  views/                      # 路由页面，按领域拆分复杂流程
  services/                   # 领域类型、service port 与默认未接入适配器
  stores/                     # Pinia；业务查询快照与运行时草稿
  i18n/
    index.ts                  # 加载、语言选择与组件库 locale 映射
    zh-CN/
      zh-CN.json
    en-US/
      en-US.json
  storage/                    # 唯一 localStorage 访问层
  theme/                      # 平台探测、token、资源和主题编排
```

- Vue 组件使用 PascalCase；普通 TypeScript 文件按当前目录约定命名，新增领域目录使用小写 kebab-case，不为小功能创建空层级。
- 测试就近放置为 `*.test.ts`；浏览器验收放在 `frontend/e2e/`。生成的 `frontend/bindings/` 不手工修改。
- 页面只通过领域 service/store 访问业务；组件和 `components/ui/` 不导入生成绑定，不直接访问 localStorage，不自行探测平台。
- 测试替身仅用于测试。运行应用使用明确返回“服务尚未接入”的适配器，不注入演示资产、任务、Connector 或扫描配置。

## 2. 一种语言一个目录、一个应用翻译 JSON

固定路径为 `i18n/<locale>/<locale>.json`，例如 `i18n/zh-CN/zh-CN.json`。同一种语言的通用、导航、功能、业务和错误文案尽量集中到该文件，通过嵌套命名空间组织；不另外维护 `business.<locale>.json` 或按功能分散语言文件。

```json
{
  "nav": {"platform": {"windows": "Windows", "unknown": "未知平台"}},
  "screen": {"portscan": {"title": "端口扫描"}},
  "error": {"scope": {"expired": "授权范围已过期"}}
}
```

- 默认语言为 `zh-CN`，完整提供 `en-US`；新增或删除 key 时同步修改所有语言。
- key 使用稳定的嵌套命名空间和变量插值，禁止句子拼接；后端只返回错误 code/messageKey 与安全 detail。
- 合并旧语言包时先检查重复 key；相同 key 的冲突必须显式解决，禁止展开对象时静默覆盖。完整性测试比较叶子 key 和插值占位符，并检查 JSON 的重复属性。
- Element Plus 自带语言包通过 `ElConfigProvider` 与应用语言同步（`zh-CN` 对应 `zh-cn`，`en-US` 对应 `en`），不复制组件库整份翻译；应用覆盖文案仍放入对应应用 JSON。
- 缺失翻译的开发诊断只显示稳定 key；生产界面使用可理解的通用回退，不展示堆栈。

## 3. 组件库职责

| 来源 | 职责 | 约束 |
| --- | --- | --- |
| Element Plus | 业务表单、表格、分页、日期、校验与反馈 | 按需引入；可组合领域组件，但不让 UI 控件定义领域规则 |
| shadcn-vue | 导航、Collapsible、移动导航和任务/通知/授权范围浮层 | 源码放入 `components/ui/`；通过应用组合组件传入状态 |
| Vue Bits | 少量非必要装饰和进入动效 | 放入 `components/effects/`；记录上游来源与改动，不表达业务进度或状态 |

使用包锁文件固定依赖；通过官方 registry/源码取得可追溯组件，在前端依赖说明记录版本或 commit、来源、许可证及本地适配。只安装使用的能力，不能仅加入一个包却继续维护同职责的第二套控件。

组件共用 Wailf 语义 token：映射 Element Plus 的 CSS variables 和 shadcn-vue 的语义变量，统一字体、颜色、圆角、密度和焦点。Tailwind 工具类可以保留，禁用会与 Element Plus 冲突的全局 preflight/reset。弹层、Select/Popover 等传送到 body 的内容也使用根 token；统一浮层层级，避免控件被模态浮层遮挡或焦点锁排除。

动效必须遵循 `prefers-reduced-motion`，减少动画时内容立即可见。装饰层不捕获指针或键盘，不影响任务、错误、授权和进度可读性。

## 4. 交互与状态

- 主区默认 `/recon/portscan`；功能注册表与布局驱动 12 组、52 个入口，未实现功能明确显示规划状态。
- 导航不显示产品 logo、名称、描述或业务上下文卡片；左下平台卡片及底部抽屉遵循[前端架构](../architecture/frontend.md)。
- 全局任务查询不要求项目标识。扫描页选择独立 TargetScope；有效授权、Connector/profile、确认缺失或业务服务未接入时，变更动作禁用并说明原因。
- 查询视图区分待接入、加载、无记录和失败；草稿只保留本次运行，浮层打开或路由切换不丢失扫描草稿。
- 异步请求使用最新请求标记；改变 Scope、任务或筛选后，旧响应不得覆盖当前状态。事件只提示重新查询，不能直接伪造业务状态。
- 保留键盘操作、语义 label、Escape、焦点圈与浮层关闭后的焦点恢复；窄窗口提供抽屉导航、安全区及可滚动的主区。

## 5. 提交验证

检查语言文件位置与完整性、组件来源及按需引用、平台卡片和抽屉交互、业务服务未接入状态、三套组件主题一致性、弹层焦点和减少动画。执行前端测试和构建，必要时执行 `wails3 build`；代码完成后不运行 `wails3 dev`。Windows Acrylic 还需要实际原生窗口检查，浏览器截图不代表材质已生效。

上游参考：[Element Plus 国际化](https://element-plus.org/en-US/guide/i18n.html)、[shadcn-vue Collapsible](https://shadcn-vue.com/docs/components/collapsible)、[Vue Bits](https://vue-bits.dev/)。
