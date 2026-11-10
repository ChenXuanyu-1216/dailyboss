# 架构基线 v0.1

## 目标

固定边界和契约，允许内容灵活替换。采用 React DOM 操作界面与 React Three Fiber 场景组合，保持纯前端、单人浏览器游戏范围。

直接在 React 外维护 Three.js 会增加生命周期管理；全 3D 界面会增加文本与触控成本。首版采用 React Three Fiber 管理 Three.js，用 DOM 显示按钮、文字与结算。

首个可运行版本已按本文实现（v0.1）。与最初草案的差异在对应小节以「实现说明」标出。

## 数据流

关卡 JSON → 配置校验 → LevelDefinition → 规则引擎 → GameState → DOM 与 3D 场景。

React 派发用户事件；界面与场景消费同一份状态。动画完成不决定通关，不用帧率决定扣血。计时器、音效、随机数和网络请求不进入纯规则函数。

## 目标文件与职责

| 位置 | 职责 |
| --- | --- |
| src/app/App.tsx | 应用装配与关卡选择 |
| src/app/levels.ts | 关卡 JSON 登记与加载（调用校验） |
| src/game/contracts.ts | 配置、状态、事件、场景协议 |
| src/game/validateLevel.ts | 配置结构、引用与资源标识校验 |
| src/game/engine.ts | 初始状态、行动、结算和重开 |
| src/game/useGame.ts | useReducer 接入 |
| src/ui/feedback.ts | 由配置数据生成每步反馈文案 |
| src/ui/copy.ts | 跨关卡通用的界面文案 |
| src/ui/GameShell.tsx | 通用布局与阶段展示 |
| src/ui/ActionPanel.tsx | 行动按钮与事件派发 |
| src/ui/ResultPanel.tsx | 结局、重开和分享 |
| src/scenes/catalog.ts | sceneId 与支持的 cue 清单（不依赖 React，供校验使用） |
| src/scenes/registry.ts | sceneId 到本地组件的白名单（懒加载） |
| src/scenes/SceneHost.tsx | 3D／简化显示切换、错误边界、上下文丢失处理 |
| src/scenes/SceneCanvas.tsx | 共享 Canvas 设置（像素比上限、按需渲染） |
| src/scenes/PrinterScene.tsx | 打印机模型与演出 |
| src/scenes/FallbackScene.tsx | WebGL 不可用时的简化显示 |
| content/levels/*.json | 阶段、行动、数值和文案 |
| src/styles/tokens.css | 颜色、间距、字体、边框与动效变量 |
| public/ | 静态资源（当前仅 favicon） |
| tests/ | Vitest：配置、规则与反馈验证 |
| e2e/ | Playwright：针对生产构建（/dailyboss/）的浏览器流程验证 |
| .github/workflows/ci.yml | CI 与 GitHub Pages 部署 |

## 内容协议

关卡字段：schemaVersion、id、title、objective、sceneId、initialPatience、initialPhaseId、phases、endings。首版 schemaVersion 为 "0.1"。

- Phase：id、title、description、cue、actions。
- Action：id、label、patienceCost、target。
- Target：{ type: "phase", id } 或 { type: "resolve" }。
- Endings：perfect、normal、failure，每项包含 title 和 description。
- initialPatience 为正整数，patienceCost 为非负整数。
- 阶段 ID 在关卡内唯一，行动 ID 在所属阶段内唯一。
- 初始阶段和所有目标阶段必须存在；允许重试自循环，必须有可达的 resolve。
- sceneId 必须在注册表内，cue 必须由对应场景支持。
- JSON 不包含可执行脚本或求值表达式，不允许任意 URL 动态导入组件。
- 未支持的协议版本和不合法配置展示可读错误。

实现说明（校验额外保证）：拒绝任何未知字段；所有阶段必须可从初始阶段到达；从任一可达阶段出发都必须仍能到达 resolve（不允许死循环陷阱）；三个结局必须齐全。校验返回仅含已知字段的冻结副本。

## 固定运行接口

```ts
type GameEvent = { type: 'ACT'; actionId: string } | { type: 'RESTART' };
type Outcome = 'perfect' | 'normal' | 'failure';

interface GameState {
  phaseId: string;
  patience: number;
  patienceSpent: number;
  history: string[];
  turns: TurnRecord[]; // 实现说明：附带阶段上下文，供反馈与记录使用
  outcome: Outcome | null;
}

interface TurnRecord { phaseId: string; actionId: string; patienceCost: number; patienceAfter: number }
type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };
interface ValidationIssue { code: ValidationCode; path: string; message: string }

// 实现说明：场景清单作为参数传入，使校验不依赖 React／Three.js。
validateLevel(input: unknown, scenes: SceneCatalog): Result<LevelDefinition>;
createInitialState(level: LevelDefinition): GameState;
transition(level: LevelDefinition, state: GameState, event: GameEvent): GameState;
```

以下为首版结算设计，供实现与试玩验证：

1. 终局只接受重开；无效行动 ID 不改变状态。
2. 合法行动先扣耐心，最低为 0，同时累计消耗并记录行动。
3. 耐心为 0 立即失败，优先于目标为 resolve 的成功判定。
4. 仍有耐心时，phase 目标切换阶段；resolve 目标结算成功。
5. 成功且累计消耗为 0 为完美，否则普通。
6. 重开恢复初始阶段与耐心、清空记录和结局。

## 改动边界

| 需求 | 修改位置 |
| --- | --- |
| 文案、行动、阶段、消耗和路径 | JSON，须通过协议校验 |
| 模型、配色、灯光和演出 | 场景组件与资源 |
| 复用玩法的新 Boss | 新 JSON、新场景与注册项 |
| 拖拽、限时操作、物理碰撞等新机制 | 协议、引擎与表现层；另行设计 |

固定的是模块接口，不是永远不变的代码。不兼容协议变更须提升版本并说明迁移方式。

## 3D 与降级

- 场景读取 GameState、当前阶段 cue 和结局；不维护第二套游戏规则。
- 首版打印机由基础几何体搭建，避免依赖尚未取得的模型。
- 离线、队列、卡纸和结局映射独立演出。
- 场景卸载时释放几何体、材质、纹理和动画资源（JSX 创建的对象由 React Three Fiber 释放；手动创建的材质在组件卸载时 dispose）。
- WebGL 不可用、资源失败或上下文丢失时显示简化场景，保留 DOM 行动和完整流程。
- 实现说明：React Three Fiber 卸载渲染器时会调用 `forceContextLoss()`，触发真实的 `webglcontextlost` 事件。SceneCanvas 在自身的 layout effect 清理中先移除监听器，因此主动卸载（如切换简化显示）不会被误报为渲染故障，挂载期间的真实上下文丢失仍会触发降级。
- 移动端限制像素比与特效数量，尊重减少动态效果偏好。性能预算在设备测试后确定。
- 实现说明：Three.js 位于懒加载分包，加载期间显示简化场景；减少动态效果时按需渲染（frameloop="demand"）。

## 验证

规则验证三种结局、无效行动、终局锁定、耐心下限及重开。配置验证字段、引用、场景和成功路径。浏览器验证电脑／手机流程和降级。视觉效果另行人工验收。
