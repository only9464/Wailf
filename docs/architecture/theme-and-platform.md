# Wailf 主题与平台适配

> 文档状态：`accepted`  
> 主题契约：`theme.v1`  运行时基线：Wails 3 `v3.0.0-beta.20`  
> 适用范围：Wails GUI；CLI、MCP 和 HTTP server 不读取主题

本文定义 GUI 主题、平台差异和启动时环境探测的边界。主题只影响界面呈现，不改变 TargetScope、Job、Artifact、Session 或任何入口协议的业务语义。本文是现行实现契约。当前前端已具备平台探测、主题级联、导入导出与故障恢复；本轮扩展 Windows Acrylic 和组件库语义变量映射，未来主题编辑器仍未实现。

## 1. 目标与不负责的内容

主题层负责：

- 把语义化 design token 解析为 CSS custom properties；
- 根据运行平台选择平台 token、资源和非视觉 hooks；
- 读取和校验 GUI 用户偏好，并在启动时稳定回退；
- 为未来主题编辑器提供版本化、可迁移的 `ThemeDefinition`。

主题层不负责：

- 业务数据、权限、TargetScope、审计、凭据或入口输出；
- 让 CLI、MCP、HTTP 返回与 GUI 相同的颜色或资源；
- 执行用户提供的 CSS、JavaScript、HTML、字体或远程代码；
- 通过 User-Agent 推断安全能力或改变平台策略。

主题是 GUI 专属偏好。`wailf cli`、`wailf mcp` 和未来 `wailf server`/HTTP adapter 不初始化主题模块、不访问 `localStorage`、不调用 `System.Environment` 来取得主题，也不读取主题资源。它们可以共享纯数据校验库，但不能产生主题副作用。

## 2. 方案比较与选择

| 方案 | 优点 | 主要问题 | 结论 |
| --- | --- | --- | --- |
| 仅用 CSS `prefers-color-scheme`/media query | 零运行时调用，浏览器天然支持 | 无法表达 Windows/macOS/mobile 的资源和 hooks；用户主题难以版本化 | 不采用 |
| 仅由浏览器 UA、`navigator.platform` 推断 | 浏览器实现简单 | UA 可缺失、变化或被伪造；Wails WebView 与真实宿主可能不一致；无法得到稳定 `OSInfo` | 只作为 `web` 的弱回退，不作为平台事实来源 |
| Go 在服务端注入全部主题 | 原生平台信息容易取得 | 把视觉偏好带进业务/入口 composition root；浏览器和 SSR 边界复杂；难以测试用户层 | 不采用 |
| 单一 `localStorage` JSON + 任意 CSS | 初期开发快 | schema、资源、hooks 和安全边界不可控；损坏一处会使整个主题不可恢复 | 不采用 |
| **三层 token registry + GUI `System.Environment` + 受限资源清单** | 平台信息有明确来源，用户层可迁移，浏览器/SSR 可无运行时回退，资源可审计 | 需要 registry、校验和启动编排；运行时版本必须锁定 | **采用** |

选择最后一项。平台差异用描述符和注册表表达，用户只能覆盖声明过的 token；所有失败路径都回退到可渲染的默认层。

## 3. 术语、ID 与描述符

### 3.1 `PlatformId`

`PlatformId` 是封闭集合，序列化值必须保持小写 ASCII：

```ts
export type PlatformId =
  | "windows"
  | "darwin"
  | "linux"
  | "android"
  | "ios"
  | "web"
  | "unknown";
```

映射规则：

| 来源 | 归一化结果 |
| --- | --- |
| `System.Environment().OS`/`OSInfo.ID` 明确为 Windows | `windows` |
| 明确为 macOS | `darwin` |
| 明确为 Linux（包含桌面 Linux） | `linux` |
| 明确为 Android | `android` |
| 明确为 iOS | `ios` |
| `PlatformInfo.mode` 明确为 server（无论宿主 `OS` 是什么） | `web` |
| 有 DOM 但不是可确认的 Wails 原生环境 | `web` |
| 空值、未知字符串、异常或超时 | `unknown` |

不把架构（`amd64`、`arm64`）混进 `PlatformId`。架构可作为描述符信息，但不能生成新的主题 ID。

描述符组合固定如下：

| 场景 | `id` | `runtimeMode` | `formFactor` |
| --- | --- | --- | --- |
| Wails Windows/macOS/Linux | 对应 OS | `desktop` | `desktop` |
| Wails Android/iOS | 对应 OS | `mobile` | `mobile` |
| Wails server build | `web` | `server` | `unknown` |
| Vite/普通浏览器 | `web` | `browser` | `unknown` |
| 探测失败或未识别 | `unknown` | `unknown` | `unknown` |

平台视觉选择使用两个正交维度：`PlatformId` 描述 OS/运行环境，`formFactor` 描述桌面或移动尺寸与交互能力。OS 不能代替 form factor（例如桌面 Linux 与移动 Linux 的布局约束不同）；响应式断点、触控密度和窗口尺寸由 `formFactor`/媒体能力处理，平台 CSS 只提供该平台的 token 与少量 hook。

`rawOS` 只用于短期诊断：接受后最多保留 32 个 Unicode 标量、剥离控制字符，不写入 localStorage、业务存储、日志或导出文件；展示和资源选择只使用归一化 `PlatformId`。

### 3.2 `PlatformDescriptor`

描述符是由静态 registry 产生的安全对象；运行时返回的原始 `EnvironmentInfo` 先经过归一化和校验，不能直接传给模板：

```ts
export interface PlatformDescriptor {
  id: PlatformId;
  rawOS: string | null;
  labelKey: string;
  source: "wails" | "browser" | "fallback";
  runtimeMode: "desktop" | "mobile" | "server" | "browser" | "unknown";
  formFactor: "desktop" | "mobile" | "unknown";
  tokenSetId: "default" | `platform.${Exclude<PlatformId, "web" | "unknown">}`;
  resourceIds: readonly PlatformResourceId[];
  hooks: PlatformHooks;
}
```

`resourceIds` 只能引用静态 allowlist 中的 ID；描述符不能携带任意 URL。`hooks` 是平台行为钩子（窗口安全区、标题栏/拖拽、输入法、减少动画等），不是用户可注入的 CSS 或脚本。

每个 `PlatformId` 都有一个有效描述符。`web` 和 `unknown` 的 `tokenSetId` 必须为 `default` 且不加载平台覆盖文件；只有五个原生 OS ID 可以使用 `platform.*` token set。缺少描述符是构建/测试错误，不在运行时临时拼装。

三个前端服务的最小方法契约如下；它们是 GUI adapter 的边界，不是 Go 领域接口：

```ts
interface ThemeSelection {
  version: 1;
  mode: "platform" | "custom";
  customId: string | null;
}

interface ThemeInitResult {
  platform: PlatformDescriptor;
  source: "platform" | "custom" | "fallback";
  usedFallback: boolean;
  diagnostics: readonly string[];
}

interface ThemeBundle {
  kind: "wailf-theme-bundle";
  version: 1;
  themes: readonly ThemeDefinition[];
}

interface ThemeExportResult {
  payload: string | null;
  usedFallback: boolean;
  diagnostics: readonly string[];
}

interface ThemeImportResult {
  acceptedIds: readonly string[];
  rejectedIds: readonly string[];
  conflictIds: readonly string[];
  committed: boolean;
  usedFallback: boolean;
  diagnostics: readonly string[];
}

interface PlatformDetectionResult {
  platform: PlatformDescriptor;
  usedFallback: boolean;
  diagnostics: readonly string[];
}

interface PlatformProvider {
  detect(): Promise<PlatformDetectionResult>;
}

interface ThemeStorage {
  loadSelection(): ThemeSelection;
  loadCustom(id: string): ThemeDefinition | null;
  saveCustom(theme: ThemeDefinition): void;
  removeCustom(id: string): void;
  exportThemes(): ThemeExportResult;
  importThemes(payload: string): ThemeImportResult;
}

interface ThemeService {
  initialize(): Promise<ThemeInitResult>;
  applySelection(selection: ThemeSelection): Promise<ThemeInitResult>;
}
```

`ThemeInitResult.source` 表示本次实际应用的层，而不是调用方请求的 mode：

| 条件 | `source` | `usedFallback` | 结果 |
| --- | --- | --- | --- |
| 请求 platform，环境、descriptor 和资源均通过校验 | `platform` | `false` | default + platform token + hooks |
| 请求 custom，定义完整通过校验，所需 platform/default 层可用 | `custom` | `false` | base/platform + user token + hooks |
| custom 缺失、过期或非法 | `fallback` | `true` | 丢弃该 custom，回退到可用的 platform/default 层 |
| 环境未知/超时、平台资源失败或解析失败 | `fallback` | `true` | 保留可用 token 和 hooks；坏层不部分应用 |
| storage 不可用或写入失败 | `fallback` | `true` | 保留内存中的上一个有效选择；首次启动无旧值时使用 platform/default |

如果 custom 的用户 token 本身有效，但平台资源失败，仍可保留已经校验的用户 token；此时 `source` 仍为 `fallback`，以便调用方和测试明确知道平台层未完整满足。`diagnostics` 只包含稳定的脱敏 code，不包含原始 OS、路径或用户 token 值。

`PlatformDetectionResult.usedFallback` 只在 runtime API 拒绝、超时、返回形状非法或 OS 无法归一化时为 `true`；正常浏览器环境归一化为 `web` 不算 fallback。平台探测的 fallback 不会覆盖已经由用户显式选择的主题偏好，但会让本次 `ThemeInitResult.source` 标记为 `fallback`，直到所需平台层成功恢复。

以上 TypeScript 片段描述职责与概念契约，具体导出名称以源码为准。`detect`、`initialize` 和 `applySelection` 都必须返回可诊断结果而不把平台/存储/资源异常抛到 AppShell；`ThemeStorage` 的写入失败回退到上一个有效选择。`exportThemes()` 正常时返回按 ID 排序的 `ThemeBundle` JSON；读取 storage 失败时返回 `payload=null`、`usedFallback=true` 和稳定诊断 code，不向 AppShell 抛异常。bundle 只包含用户 `ThemeDefinition`，不包含活动指针、平台 descriptor、hooks 或任何业务数据；这样导入不会悄悄改变当前主题，调用方需在成功导入后显式调用 `applySelection`。`importThemes()` 要求 `kind="wailf-theme-bundle"`、`version=1` 和整个 `themes` 数组通过校验：重复 ID、现有 ID 冲突或任一条定义非法时，`committed=false` 且整个批次不写入；只有全部通过时才一次性提交，`acceptedIds` 才表示已写入的 ID。校验拒绝本身不算 fallback，只有 storage 写入/恢复失败时 `usedFallback=true`。有效 ID 的 schema 错误归入 `rejectedIds`；bundle 内重复或与现有存储冲突归入 `conflictIds`；没有可安全提取 ID 的条目只返回 `theme.bundle.invalid_shape` 等 diagnostics code。上述类型不允许携带任意 CSS、URL 或业务对象。

## 4. 三层 cascade

主题解析固定为三层，顺序不可由用户配置改变：

```text
base (platform 或 default)
  -> platform token layer（仅当 base=platform）
    -> user ThemeDefinition.tokens（仅声明的 token）
```

### 4.1 base 层

`base` 只有两个值：`"platform"` 和 `"default"`。

- `base="platform"`（默认）先加载中性 default token，再叠加当前 `PlatformId` 的平台 token；这是完整 GUI 的默认路径。
- `base="default"` 只使用中性 token，适合无平台信息、兼容模式和主题预览。
- 即使 `base="default"`，平台 hooks 仍然保留；base 只决定 token，不关闭窗口安全区、输入法、拖拽等平台行为。

### 4.2 platform token layer

平台 token 只表示经过 registry 审核的视觉差异，例如密度、系统字体栈、滚动条颜色或高对比度默认值。平台样式 link 在已知平台上始终加载；文件内部必须将 token 声明放在 `html[data-theme-base="platform"]` 下，将 safe-area、标题栏和拖拽等 hook 声明放在 `html[data-platform="..."]` 下。这样 `base="default"` 只跳过平台 token，不会跳过 hook。根元素标记只使用：

```html
<html data-theme-base="platform" data-platform="windows">
```

`data-theme-base` 的值只能是 `platform` 或 `default`，它是“平台 token 层是否启用”的唯一标记。**平台 token 不得用 `data-platform` 作为 CSS 选择器来源**，避免把平台探测值扩散成任意主题选择器。

`data-platform` 始终存在，但只供 hooks 使用：

```css
html[data-platform="ios"] .app-shell { /* safe-area hook */ }
html[data-platform="windows"] .titlebar { /* titlebar hook */ }
```

hooks 的来源是 `PlatformDescriptor.hooks` 和固定的安全策略。用户主题不持久化 hooks；任何临时的无障碍或动效偏好都必须先登记为受控 token，不能删除、替换或注入平台 hooks。

### 4.3 user layer

用户层只覆盖 `TokenRegistry` 中存在的 token，且只覆盖允许的类型和值域。未声明的 token 继续沿用 base/platform 层；用户层无效时整体丢弃，不留下半套 CSS。

实现时平台覆盖使用唯一的 `<link data-wailf-platform-theme>`，用户覆盖使用唯一的 `<style data-wailf-theme-user>` 或等价的受控 `style.setProperty` 调用。切换或恢复平台主题必须先移除旧层、清理旧 token，再原子应用新层，不能累积重复节点。

解析伪代码：

```ts
function resolveTheme(
  platform: PlatformDescriptor,
  preference: ThemePreference,
  custom?: ThemeDefinition,
): ResolvedTheme {
  const base = preference.mode === "custom" ? custom?.base ?? "platform" : "platform";
  const defaults = registry.defaultTokens();
  const platformTokens = base === "platform"
    ? registry.platformTokens(platform.id)
    : {};
  const userTokens = preference.mode === "custom" && custom
    ? validateAndSelectTokens(custom.tokens)
    : {};

  return {
    tokens: merge(defaults, platformTokens, userTokens),
    hooks: preservePlatformHooks(platform.hooks),
    base,
    platform,
  };
}
```

这里的 `merge` 是按 token key 的浅层覆盖，不接受深层对象合并、CSS 文本或任意属性名。瞬时的 focus、reduced-motion、forced-colors 等状态属于 hooks，不构成第四个持久化主题层。

## 5. `ThemeDefinition` 与 localStorage 多键契约

### 5.1 `ThemeDefinition`（`theme.v1`）

```ts
export type TokenKey = string & { readonly __tokenKey: unique symbol };
export interface TokenGradient {
  kind: "linear";
  angle: number;
  stops: readonly { color: string; position: number }[];
}
// 这是导入/导出 JSON 的值形状，不代表未经校验的字符串可以直接写入 CSS。
export type TokenValue = string | number | TokenGradient;
export type ValidatedTokenValue =
  | (string & { readonly __validatedToken: unique symbol })
  | number
  | (TokenGradient & { readonly __validatedGradient: unique symbol });

export interface PlatformHooks {
  safeArea: "env" | "none";
  titlebar: "native" | "custom" | "none";
  draggable: boolean;
  motion: "system" | "reduced";
}

export type ThemePreference = ThemeSelection;

export interface ResolvedTheme {
  tokens: Readonly<Record<TokenKey, ValidatedTokenValue>>;
  hooks: PlatformHooks;
  base: "platform" | "default";
  platform: PlatformDescriptor;
}

export interface ThemeDefinition {
  version: 1;
  id: string;
  name: string;
  base: "platform" | "default";
  tokens: Partial<Record<TokenKey, TokenValue>>;
}
```

`ValidatedTokenValue` 是实现内部的概念类型：它只包含已经按 registry 标记为颜色、长度、数字、枚举或结构化 `TokenGradient` 的值；实现可以用 branded type 表达它。`ThemeDefinition.tokens` 中的 `TokenValue` 仍是未信任的 JSON 形状，不能直接传给 `style.setProperty`。gradient 不接受自由格式字符串，只能使用上面声明的 `kind`、角度和 stops 字段。

约束：

- `id` 只能匹配 `[a-z0-9][a-z0-9._-]{0,63}`；`name` 必须是 NFC 规范化的纯文本，最多 64 个 Unicode 标量，不得包含控制字符或 HTML；内置主题的界面文案仍使用 i18n key。
- `version` 必须为数字 `1`。未来 schema 变更使用显式迁移，不猜测版本。
- `tokens` 的 key 必须来自 `TokenRegistry`；未知 key、值类型或值域错误会使整个定义导入失败，不能静默变成 CSS 属性或部分应用。
- 单个定义的安全上限固定为 64 KiB、256 个 token、每个字符串不超过 2 KiB；超限拒绝。

稳定 JSON 形状与存储契约一致：

```json
{
  "version": 1,
  "id": "user-midnight",
  "name": "Midnight",
  "base": "platform",
  "tokens": {
    "color.canvas": "#06070f",
    "color.text.primary": "#f4f6fb",
    "color.action.primary": "#ff4d4d",
    "layout.radius.md": "11px"
  }
}
```

解析后的内部对象为 `ResolvedTheme`，不直接暴露原始 JSON。应用 CSS 时由 registry 生成属性名和值，并对每个值再次校验。

### 5.2 存储键

GUI storage 模块独占 `localStorage` 访问。业务组件、store 和主题编辑器不得直接调用浏览器 API。

主题导入/导出使用独立的 `ThemeBundle`，不导出当前选择或平台信息：

```json
{
  "kind": "wailf-theme-bundle",
  "version": 1,
  "themes": [
    {
      "version": 1,
      "id": "user-midnight",
      "name": "Midnight",
      "base": "platform",
      "tokens": {
        "color.canvas": "#06070f",
        "color.text.primary": "#f4f6fb"
      }
    }
  ]
}
```

导出时只包含用户定义，按 `id` 的 ASCII 字典序排序；内置 default/platform token、`PlatformDescriptor`、hooks、活动指针和业务数据永不进入 bundle。导入是全量原子操作：任一条定义非法、bundle 内重复或与现有 ID 冲突时不写入任何定义，并返回相应的 `rejectedIds`/`conflictIds`；成功后只保存定义，活动主题保持不变，由调用方显式选择导入的 ID。

bundle 级约束固定为：`kind` 必须精确等于 `wailf-theme-bundle`，`version` 只接受数字 `1`；未知顶层字段读取时忽略、导出时剥离，未知 kind/version 以 `theme.bundle.unsupported` 拒绝，不猜测迁移。`themes` 最多 32 条、整个 UTF-8 JSON 不超过 2 MiB、总 token 数不超过 4096；空数组是合法 no-op。单条定义仍受 64 KiB、256 token 和字符串长度上限约束。超过任一上限时 `committed=false` 且不写入。

`localStorage` 没有跨 key 事务，原子性通过受保护的 staging 协议实现：先完成整个 bundle 校验，再把定义写入内部保留前缀 `wailf.ui.theme.stage.<nonce>.<id>`，最后写入包含 ID 列表和校验摘要的 commit marker；marker 之前的中断只清理 staging，marker 之后的中断在下次启动按 marker 校验后完成提升或整体清理。正式键只在提升阶段写入，导入不覆盖既有 ID，也不触碰 `wailf.ui.theme` 活动指针。配额/写入/恢复失败保持旧定义和选择，返回 `usedFallback=true` 与脱敏 diagnostics code；`ThemeImportResult.diagnostics` 永远只含稳定 code，不含原始 JSON、路径或异常文本。

`wailf.ui.theme.stage.*` 和对应 commit marker 是实现内部的临时键，不属于对外稳定存储键；读取活动主题前必须处理并清理它们，导出也不得包含它们。

活动主题指针固定为一个 JSON 对象：

```text
wailf.ui.theme = {
  "version": 1,
  "mode": "platform" | "custom",
  "customId": string | null
}
```

具体用户定义按 ID 分键：

```text
wailf.ui.theme.custom.<id> = ThemeDefinition JSON
```

契约细节：

- `mode="platform"` 时 `customId` 必须为 `null`；`mode="custom"` 时 `customId` 必须为合法 ID 且对应定义存在。
- `ThemeDefinition.id`、`customId` 和 `wailf.ui.theme.custom.<id>` 的 `<id>` 必须是同一个 ASCII 小写规范化结果；不接受大小写别名、Unicode 归一化差异或路径分隔符。
- 读取顺序是“先解析并校验 custom 定义，再接受指针”。定义缺失、版本不支持或校验失败时回退到 `mode="platform"`，不抛出启动异常。
- 写入 custom 时先写定义、再写活动指针；删除或替换时先切换指针、后清理旧定义，降低崩溃造成的悬空引用。
- 未知顶层字段不参与解析，写回时剥离；未知 `custom.<id>` 键不影响活动主题，可由显式清理动作回收。
- 旧版把 `wailf.ui.theme` 存为字符串、空值或损坏 JSON 时，执行一次性迁移：可识别的 `light`/`dark` 映射到内置定义，其他值直接回退 platform；迁移失败不得阻塞 GUI。
- 浏览器禁用 storage、配额不足或隐私模式抛错时使用内存中的 platform/default，并记录脱敏诊断；不把主题写入 SQLite、日志或凭据存储。

`wailf.ui.theme` 与既有 `wailf.ui.language`、`wailf.ui.sidebarWidth` 等键同属 GUI 偏好命名空间，但不能合并成一个无版本的大对象。

## 6. Token registry 与现有硬编码迁移

### 6.1 registry 原则

`TokenRegistry` 是唯一允许的主题 token 清单。每项至少声明：`key`、值类型、默认值、可选平台覆盖、可选范围/枚举、是否允许用户覆盖、弃用别名。推荐命名空间：

```text
color.canvas
color.surface.default
color.surface.elevated
color.surface.glass
color.border.subtle
color.text.primary
color.text.muted
color.action.primary
color.action.secondary
color.focus.ring
effect.gradient.primary
effect.shadow.action
layout.radius.sm
layout.radius.md
layout.density
font.family.ui
motion.duration.fast
accessibility.color-scheme
```

组件只消费语义 token（例如 `var(--wailf-color-text-primary)`），不消费平台 ID 或原始 hex。registry 输出属性名时统一加 `--wailf-` 前缀。

### 6.2 组件库 token 映射

当前工作台已使用 Wailf 语义 token。加入组件库时，Element Plus 的 `--el-color-*`、背景、填充、文本、边框、圆角与字体变量，以及 shadcn-vue 的 background、foreground、card、popover、sidebar 等语义变量均由 Wailf token 映射。组件库样式是消费层，不是第四个可持久化主题层。

- 业务表单、表格及 Select/Popover 等弹出内容与主区同步深浅色和用户 tint。
- Tailwind 不加载与 Element Plus 冲突的第二套全局 reset；控件密度和焦点使用统一变量。
- 动画遵循 `prefers-reduced-motion`，业务进度和状态不依赖装饰动画。
- 历史欢迎页背景不再承担工作台主题；v1 用户主题仍不允许导入图片、远程 URL 或任意 CSS。

### 6.3 Windows 原生 Acrylic

Windows 窗口由 Go 配置 `BackgroundType: application.BackgroundTypeTranslucent` 和 `Windows.BackdropType: application.Acrylic`，保留系统标题栏与原生按钮；不得用无边框自绘替代。窗口背景维持透明，其他平台保留既有配置。本轮 Go 改动仅限该窗口适配。

原生材质和根背景透明性属于平台能力/hook，独立于用户 theme tokens。Windows 的 `html/body/#app`、侧栏、主区、页头、底部抽屉、Sheet 和 popup 使用受控透明 surface，局部输入框与文本保持可读对比度。用户把 canvas/surface token 设为不透明颜色时，该颜色只用作 surface tint，不能形成遮住整个 DWM 材质的实色页面。即使平台 CSS 资源加载失败，关键透明能力 hook 也需随基础应用保留；纯浏览器不宣称具有原生 Acrylic。

不使用逐层 `backdrop-filter: blur(...)` 模拟原生材质。Windows 11 build 22621+ 可使用 DWM 原生 Acrylic；旧系统由当前 Wails/窗口框架走兼容模糊。系统关闭透明时允许系统回退；`forced-colors: active` 优先应用可读实色、系统文本与边框，不能以透明效果压过无障碍设置。前端平台标识只说明运行环境，不能证明系统实际启用了材质。

验收必须单独打开 `wails3 build` 产出的 Windows 窗口检查主区、侧栏、浮层、系统标题栏、深浅色和实色回退。浏览器截图、模拟 Windows PlatformDescriptor 或构建成功都不等同于原生材质验收。其他系统本轮不扩展视觉设计，只保留现有安全区、macOS 50px 顶部留白和兼容主题。

依据：[ADR-0011](../adr/ADR-0011-windows-acrylic-material.md)、Microsoft [DWM_SYSTEMBACKDROP_TYPE](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type) 与 [Acrylic](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic)。

## 7. 平台资源、allowlist 与 `BASE_URL`

平台资源必须是构建产物或同源嵌入资源，不从用户输入或远程地址加载。实现预留一个构建时常量：

```ts
export const THEME_BASE_URL = `${import.meta.env.BASE_URL}themes/platform/`;
```

`import.meta.env.BASE_URL` 是 Vite 构建配置提供的前缀；主题目录固定追加为 `themes/platform/`。不能让查询参数、localStorage 或 `ThemeDefinition` 覆盖它。Wails 打包后资源仍应通过嵌入的 asset server 提供；不允许把 `THEME_BASE_URL` 改成任意 `http(s)` 源。

首期平台样式资源固定为：

```text
frontend/public/themes/platform/windows.css
frontend/public/themes/platform/darwin.css
frontend/public/themes/platform/linux.css
frontend/public/themes/platform/android.css
frontend/public/themes/platform/ios.css
```

代码只能通过 `PlatformId -> relativePath` 的静态表选择这些文件；`web` 和 `unknown` 不加载平台覆盖文件。每个文件只能包含语义 token 和少量平台 chrome hook，不得复制 `style.css` 的结构、组件布局或业务选择器。

allowlist 由代码静态声明并在构建时检查：

```ts
export type PlatformResourceId =
  | "platform.windows"
  | "platform.darwin"
  | "platform.linux"
  | "platform.android"
  | "platform.ios";
```

首期 token 资源映射固定为：

```text
platform.windows -> windows.css
platform.darwin  -> darwin.css
platform.linux   -> linux.css
platform.android -> android.css
platform.ios     -> ios.css
```

default token 由同步加载的 `style.css` 提供；每个 `platform.*` CSS 文件同时包含其固定的 token 块和 hook 块，不再拆出可由用户选择的 hook 资源 ID，也不能由用户定义新的相对路径。

资源解析只接受 `PlatformResourceId -> relativePath` 的静态映射，并检查：

- 路径不能包含 `..`、反斜杠、协议、片段或查询串；
- 最终 URL 必须是 `THEME_BASE_URL` 下的同源路径；
- `THEME_BASE_URL` 的斜杠和 Vite base 前缀必须在构建时归一化，禁止运行时拼接双斜杠或丢失前缀；
- 扩展名、MIME、大小和可选的构建 hash 必须匹配 manifest；
- 只加载当前 descriptor 声明的资源，不递归扫描目录；
- `404`、非 2xx、校验失败、重定向到外源或加载超时只跳过该资源，继续用 default/platform token；
- 资源不执行脚本，不允许 `@import` 外部 CSS；CSP 和构建检查应阻止远程注入。

未来若需要平台背景图片，必须先新增独立的静态 asset manifest、资源根和 Wails 打包测试，不能把图片路径绕过 allowlist 塞入 `ThemeDefinition`；本轮 Windows 材质由原生窗口提供。

`data-theme-base="platform"` 只表示平台 token layer 已选中；资源 manifest 的选择依据是已校验的 `PlatformId`。`data-platform` 只驱动 hooks，不能拼接资源路径。

## 8. `System.Environment` 启动时序与回退

Wails runtime 版本锁定为与仓库基线一致的 Wails 3 `v3.0.0-beta.20`。在 Wails GUI 中，`System.Environment()` 是首期唯一权威的平台来源；`System.IsWindows()` 等同步便捷方法不能作为唯一启动检测或替代来源。首期不新增业务 Go `RuntimeInfoService` 或自定义平台 API。`@wailsio/runtime`、生成 bindings 和 Go/Wails CLI 必须锁定到同一兼容线，禁止 `latest` 或跨 beta 自动升级；升级必须通过单独 ADR、更新测试矩阵和重新生成 bindings。当前依赖若显示其他 beta 版本，应作为迁移事项处理，不能在主题代码中兼容多个未锁定 API。

主题 bootstrap 不在模块 import 时触碰 `window`/`document`。推荐时序如下：

```ts
import { System } from "@wailsio/runtime";
```

1. **加载基础样式（HTML）**：`index.html` 同步加载 `frontend/public/style.css`；该文件包含完整结构、响应式规则和 default token，平台探测不能成为首帧样式的前置条件。
2. **建立中性根状态（同步）**：确认有 DOM 后，把 `data-theme-base="default"`、`data-platform="unknown"` 写入 `<html>`；初始化失败也能渲染。
3. **恢复并读取偏好（同步、容错）**：storage adapter 先处理 staging/commit marker，完成上一批导入的提升或清理，再读取并校验 `wailf.ui.theme`；最终只得到 `platform` 或一个可信的 custom ID，不把原始 JSON 交给 Vue。
4. **启动环境查询（异步）**：在调用前注册一次 `wails:runtime-config-ready` 监听，GUI 调用 `System.Environment()`，以约 `500ms` 的 timeout 包住 Promise。只允许一个 in-flight probe；事件只负责唤醒一次未就绪的 probe，不能产生并发调用或无限重试；成功、失败或超时后都必须移除监听器；事件不是唯一来源，直接 API 调用和 timeout 仍然必需。
5. **归一化 descriptor**：成功时从 `OS`/`OSInfo` 映射到 `PlatformId`，从静态 registry 取得 descriptor；未知值归一化为 `unknown`。
6. **解析三层主题**：按 base/platform/user 顺序合并，校验资源 manifest，生成 CSS custom properties。
7. **应用根属性和 hooks**：始终设置 `data-platform=<PlatformId>`；只有平台 token 成功选择时设置 `data-theme-base="platform"`，否则保持 `default`。平台 hooks 必须保留，即使 token 或资源加载失败。
8. **挂载/更新 GUI**：Vue 应用立即挂载，探测和平台 CSS 加载在后台完成；`ThemeService` 为每次用户选择维护单调递增的 preference revision，晚到的合法结果只有在 revision 未变化时才能在下一帧幂等更新 token，不能覆盖用户刚选择的主题、清空页面、重载路由或改变业务状态。

环境请求失败、超时、404 或返回形状不符合预期时，必须完成以下回退：

| 失败点 | `data-platform` | `data-theme-base` | 行为 |
| --- | --- | --- | --- |
| `System.Environment` 超时/异常 | `unknown` | `default` | 不阻塞 GUI；使用中性 token 和通用 hooks |
| 环境成功但 OS 未知 | `unknown` | `default` | 记录脱敏诊断，不猜测平台 |
| descriptor/token 资源 404 或校验失败 | 已归一化 ID | `default` | 跳过坏资源，保留 hooks 和中性可渲染 token |
| custom 定义损坏/缺失 | 已归一化 ID | `platform`（若可用）否则 `default` | 回退并可清理坏 custom key |
| `localStorage` 不可用 | 已归一化 ID | `platform`（若可用）否则 `default` | 使用内存偏好，不写业务存储 |

500ms 是启动查询的上限，不是资源下载的许可；资源也必须有独立短超时。所有错误只进入开发诊断/安全日志，不能把原始环境数据、路径或用户定义写入普通日志。

## 9. 浏览器、SSR 与 server 边界

| 场景 | 环境来源 | 主题行为 | 禁止事项 |
| --- | --- | --- | --- |
| Wails GUI | 锁定 runtime 的 `System.Environment` | 完整三层 cascade、平台资源和 hooks | 不把环境信息当业务授权 |
| Vite 浏览器开发/普通 WebView | DOM；可安全识别时为 `web` | default token，可读取 GUI localStorage | 不用 UA 作为安全事实，不请求 Wails API |
| SSR/预渲染 | 无 DOM、无 localStorage | 纯函数输出 default 或调用方传入的已校验 token | import 时访问 `window`/`document`/`System.Environment` |
| CLI | Go composition root | 不初始化主题 | 不读 GUI storage/资源 |
| MCP | MCP adapter | 不初始化主题 | 不把主题字段放进工具 schema |
| HTTP server | 未来独立 adapter | 不读取 GUI 主题；如需品牌化由 server 自己定义 HTTP 样式契约 | 不复用 GUI localStorage 或 `System.Environment` |

主题纯函数（类型、registry、校验和合并）可以在测试或 SSR 中复用；副作用模块（Wails runtime、DOM、localStorage、资源加载）必须留在 `frontend/src/theme` 的 GUI adapter 内。

## 10. 安全与校验

- 所有输入均视为不可信：localStorage、导入文件、浏览器 storage 和运行时环境都先 parse、schema 校验、范围校验，再应用。
- token 值只允许 registry 声明的颜色、长度、数字、枚举或有限 gradient 结构；拒绝 `url()`, `@import`, `expression`, `javascript:`, CSS 注释注入、控制字符和超长字符串。
- `TokenGradient` 只允许 `linear`、有限角度和 2 至 5 个有序 stops；颜色与位置分别按 registry 的颜色语法和 `0..1` 范围校验，再由 registry 序列化为 CSS，不能接受自由格式 gradient 字符串。
- CSS 属性名由 registry 生成，禁止把用户 key 拼进 `style.setProperty`；不使用 `innerHTML` 注入主题。
- 资源只接受静态 `PlatformResourceId` 或基础 CSS manifest ID，执行 allowlist、同源、MIME、大小和可选 hash 校验；不跟随外源重定向。
- `id`、i18n key、版本和对象原型键（例如 `__proto__`、`constructor`）都必须显式拒绝或剥离。
- 失败采用 fail-closed：丢弃有问题的层或资源，回退 default/platform，不部分应用未经校验的数据。
- 主题不含凭据、TargetScope、扫描结果或任何秘密；导出/导入只处理 `ThemeBundle` 及其中的 `ThemeDefinition`，不接受其他业务数据。
- localStorage 是可被同源脚本读取的 GUI 偏好区，不能被当作秘密存储；CSP、依赖审计和 XSS 防护仍然适用。
- 对定义大小、token 数、资源数量和加载时间设上限，避免恶意主题造成内存或启动 DoS。

## 11. 实现边界

前端目录、组件和语言文件规则的唯一来源为[前端开发规范](../development/frontend-conventions.md)。主题类型、registry、平台归一化、System.Environment adapter、资源 allowlist、级联和启动编排位于 `frontend/src/theme/`；主题 localStorage 操作位于统一的 `frontend/src/storage/theme.ts`，不能另外建立可绕过 storage 的读取路径。

主题业务组件只通过 preference store / theme service 取得解析结果。不要把主题逻辑放入 Go 领域包、Wails 业务 service、CLI/MCP/HTTP 入口或 `features/*`。Windows GUI 窗口的原生 Acrylic 配置是唯一必要的 Go 宿主视觉适配；未来编辑器仍只处理受校验的 token。

## 12. 未来主题编辑器

编辑器是 GUI-only 功能，面向 registry 中可编辑的 token：

1. 读取 `TokenRegistry` 元数据，渲染颜色、数值、枚举和资源选择控件；不提供 CSS/JS 文本框。
2. 修改只作用于内存预览层；点击保存时生成 `ThemeDefinition v1`，先完整校验，再按“定义后指针”的顺序写入多键 storage。
3. 导入文件按不可信输入处理，显示未知 token、被截断字段和迁移结果；不能静默执行或联网下载资源。
4. 预览始终保留平台 hooks、键盘焦点、对比度、reduced-motion 和 forced-colors 约束；主题不能隐藏安全提示或授权状态。
5. 未来 schema 升级提供 `migrate(v1 -> v2)` 并保留导出版本；删除或重命名 token 时提供 registry alias 和用户提示。

编辑器产生的定义只影响当前 GUI。它不会改变 CLI 输出、MCP 工具描述、HTTP 响应或后端审计内容。

## 13. 测试矩阵与验收

| 维度 | 场景 | 断言 |
| --- | --- | --- |
| 平台探测 | Windows/macOS/Linux/Android/iOS 的已知 `EnvironmentInfo` | 归一化到正确 `PlatformId`，descriptor 完整，`data-platform` 正确 |
| 平台探测 | 空值、未知 OS、异常、500ms timeout | 不阻塞挂载，`unknown` + `data-theme-base=default`，保留通用 hooks |
| 浏览器/SSR | 无 Wails runtime、无 DOM、SSR import | 不访问浏览器全局或 `System.Environment`，输出可渲染 default |
| cascade | platform base、default base、custom partial tokens | 顺序为 base → platform → user；未声明 token 继承；base default 仍保留 hooks |
| storage | 合法 v1、旧字符串、损坏 JSON、缺失 custom、配额异常 | 迁移/回退可重复且不抛启动异常；写入顺序正确 |
| ThemeBundle | 合法导出排序/round-trip、未知 kind/version、空数组、超限、bundle 内重复、现有 ID 冲突、单条非法、storage 中途失败 | 全量校验后原子提交；失败恢复完成后为全批次或零新增正式键，活动选择不变；staging marker 可恢复或清理；`usedFallback` 只在 storage/recovery 失败时为 `true` |
| schema 安全 | 未知 key、CSS 注入、原型键、超长值、非法 ID | 拒绝或剥离，绝不生成任意 CSS/URL |
| 资源 | allowlist 命中、路径遍历、外源 URL、404、重定向、MIME/大小/hash 错误 | 只加载同源允许资源；坏资源跳过，页面继续渲染 |
| Windows Acrylic | 原生窗口、普通浏览器、用户不透明 tint、系统透明关闭与 forced-colors | 原生能力不被用户颜色覆盖；回退可读；浏览器结果不冒充原生验收 |
| hooks | 各平台 safe-area/titlebar/reduced-motion 和 user token override | `data-platform` 负责 hooks；用户不能删除关键 hook；无平台 token 时仍生效 |
| runtime | 锁定 beta.20 的真实/模拟 `System.Environment`、探测期间切换主题 | 只调用一次；revision 变化后晚到结果不得覆盖用户选择；不依赖未锁定 API |
| 入口隔离 | CLI、MCP、HTTP 进程/adapter | 不导入主题副作用模块、不读 GUI localStorage、不调用 `System.Environment` |
| 视觉回归 | default、每个平台、典型 custom theme，窄/宽窗口 | token 完整、对比度和布局稳定，无 FOUC/遮挡 |
| 编辑器 | 预览、保存、导入、迁移、恢复默认 | 只产生合法 ThemeDefinition；未保存预览不污染 storage |

自动化至少覆盖纯函数和 storage/资源 adapter；Wails e2e 只验证 GUI 启动和 platform bridge，不把真实扫描器或远程目标带入测试。验收条件是任何环境、storage 或资源异常都能在有限时间内显示可用 GUI，且三入口边界不被主题依赖穿透。

## 14. 关联文档

- [前端架构](frontend.md)：`preferenceStore`、storage 封装和 GUI 外壳边界。
- [入口契约](entry-contracts.md)：GUI、CLI、MCP、HTTP 的不对称入口原则。
- [架构总览](overview.md)：Wails GUI 与其他运行模式的依赖方向。
- [安全与治理](../security/governance.md)：localStorage、秘密和日志安全底线。
- [ADR-0007：Vue 前端基线](../adr/ADR-0007-Vue前端基线.md)：Vue/TypeScript/Vite 与 Wails runtime 基线。
- [ADR-0008：平台主题与用户主题分层](../adr/ADR-0008-平台主题与用户主题分层.md)：本方案的取舍和长期后果。
