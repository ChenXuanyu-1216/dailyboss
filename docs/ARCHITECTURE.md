# 架构基线（协议 v0.1 / v0.2）

## 目标

固定边界和契约，允许内容灵活替换。采用 React DOM 操作界面与 React Three Fiber 场景组合，保持纯前端、单人浏览器游戏范围。

直接在 React 外维护 Three.js 会增加生命周期管理；全 3D 界面会增加文本与触控成本。首版采用 React Three Fiber 管理 Three.js，用 DOM 显示按钮、文字与结算。

首个可运行版本已按本文实现（v0.1）。与最初草案的差异在对应小节以「实现说明」标出。迭代 1 在此基础上做了向后兼容的增量扩展（协议 v0.2，见「内容协议」）。

## 数据流

关卡 JSON → 配置校验 → LevelDefinition → 规则引擎 → GameState → DOM 与 3D 场景。

React 派发用户事件；界面与场景消费同一份状态。动画完成不决定通关，不用帧率决定扣血。计时器、音效、随机数和网络请求不进入纯规则函数。

技巧判定（v0.2）由表现层的小游戏完成：用 `performance.now()` 时间戳（而非帧数）判断，结果只以 `'success' | 'fail'` 随 ACT 事件传入引擎。引擎本身仍然没有计时器。

实时战斗（v0.3）分两层：`src/game/fight.ts` 是纯函数的战斗模拟，`stepFight(def, state, input, dtMs)` 按 10 ms 子步推进并返回新状态与事件，随机数是状态里带种子的生成器；`src/ui/FightArena.tsx` 拥有时钟（`requestAnimationFrame` 中的 `performance.now()` 差值，单帧最多 100 ms，辅助模式乘 0.65）和输入设备。规则引擎看不到战斗状态，只接收结果：每次被击中一个 `HIT` 事件，打赢时一个 `FIGHT_WON` 事件。

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
| src/ui/ActionPanel.tsx | 行动按钮与事件派发（技巧行动带标记） |
| src/ui/skills.ts | 小游戏的纯函数规则（指针位置、绿区、连打窗口） |
| src/ui/SkillChallenge.tsx | 时机／连打小游戏界面，产出判定结果 |
| src/ui/BossHud.tsx | Boss 血条、「BOSS 出现」标题卡、浮动扣耐心提示 |
| src/game/fight.ts | 实时战斗的纯函数模拟（v0.3）：招式、技能、命中与胜负 |
| src/game/fights.ts | 已登记的战斗（招式编排与数值），供关卡 `fight.id` 引用与校验 |
| src/ui/FightArena.tsx | 战斗区域：时钟、键盘与触屏输入、渲染，向上报告被击中与胜利 |
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
| tests/ | Vitest：配置、规则、反馈、小游戏规则与战斗平衡（脚本玩家见 tests/fightBot.ts） |
| tests/fixtures/printer-v0.1.json | 原 v0.1 关卡，保证旧协议仍可加载、玩法不变 |
| tests/fixtures/printer-v0.2.json | 迭代 1 的菜单式 v0.2 关卡，继续覆盖行动与技巧判定规则 |
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

### v0.2 增量字段（迭代 1）

`schemaVersion` 可为 `"0.1"` 或 `"0.2"`。以下字段均为可选，只允许出现在 v0.2 文件中（在 v0.1 文件中按未知字段拒绝，保证旧文件含义不变）：

- Phase `intensity`：`calm`｜`warning`｜`critical`。未声明时按位置推导（首个 calm、最后一个 critical、其余 warning），与 v0.1 一致。`critical` 阶段即 Boss 回合。
- Action `feedback`：行动成功后显示的打印机反应文案（非空字符串）。未提供时使用通用文案。
- Action `skill`：`{ type: "timing" | "mash", onFail: { patienceCost, target, feedback? } }`。带技巧的行动需要判定结果：成功走行动自身的 `patienceCost` 与 `target`，失败走 `onFail` 的消耗与目标。`onFail.target` 参与引用、可达性与陷阱检查。

升级方式：把 `schemaVersion` 改为 `"0.2"` 后按需添加上述字段；v0.1 文件无需修改即可继续使用。

### v0.3 增量字段（迭代 2）

`schemaVersion` 可为 `"0.3"`。v0.3 文件可以使用全部 v0.2 字段，另外：

- Phase `fight`：`{ id, target, feedback? }`。`id` 必须是 `src/game/fights.ts` 中已登记的战斗（否则 `unknown-fight`）；`target` 是打赢后的去向（phase 或 resolve），参与引用、可达性与陷阱检查；`feedback` 是打赢后的文案。
- 战斗阶段不写 `actions`（同时出现时报错）；校验结果中它的 `actions` 为空数组。非战斗阶段仍必须有非空的 `actions`。
- `fight` 出现在 v0.1／v0.2 文件中按未知字段拒绝。

## 固定运行接口

```ts
type GameEvent =
  | { type: 'ACT'; actionId: string; skill?: 'success' | 'fail' }
  | { type: 'HIT'; attack: 'paper' | 'toner' } // v0.3
  | { type: 'FIGHT_WON' } // v0.3
  | { type: 'RESTART' };
type Outcome = 'perfect' | 'normal' | 'failure';

interface GameState {
  phaseId: string;
  patience: number;
  patienceSpent: number;
  history: string[];
  turns: TurnRecord[]; // 实现说明：附带阶段上下文，供反馈与记录使用
  outcome: Outcome | null;
}

// patienceCost 为实际扣除值（技巧失败时为 onFail 的消耗）；skill 仅出现在技巧行动上
// 战斗回合：fight 为 'hit'（actionId 为攻击种类）或 'won'（actionId 为战斗 ID）；history 只记录行动
interface TurnRecord { phaseId: string; actionId: string; fight?: 'hit' | 'won'; patienceCost: number; patienceAfter: number; skill?: 'success' | 'fail' }
type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };
interface ValidationIssue { code: ValidationCode; path: string; message: string }

// 实现说明：场景清单作为参数传入，使校验不依赖 React／Three.js。
validateLevel(input: unknown, scenes: SceneCatalog): Result<LevelDefinition>;
createInitialState(level: LevelDefinition): GameState;
transition(level: LevelDefinition, state: GameState, event: GameEvent): GameState;
```

以下为首版结算设计，供实现与试玩验证：

1. 终局只接受重开；无效行动 ID 不改变状态。技巧行动缺少判定结果、或非技巧行动带有判定结果时，同样不改变状态。
2. 选择分支：技巧失败用 `onFail` 的消耗与目标，否则用行动自身的。合法行动先扣耐心，最低为 0，同时累计消耗并记录行动。
3. 耐心为 0 立即失败，优先于目标为 resolve 的成功判定。
4. 仍有耐心时，phase 目标切换阶段；resolve 目标结算成功。
5. 成功且累计消耗为 0 为完美，否则普通。
6. 重开恢复初始阶段与耐心、清空记录和结局。
7. 战斗阶段（v0.3）不接受 ACT。`HIT` 扣 1 耐心（同第 2–3 条，归零即失败）；`FIGHT_WON` 不扣耐心，按 `fight.target` 走第 4–5 条。两者在非战斗阶段和终局时都不改变状态。

## 改动边界

| 需求 | 修改位置 |
| --- | --- |
| 文案、行动、阶段、消耗和路径 | JSON，须通过协议校验 |
| 模型、配色、灯光和演出 | 场景组件与资源 |
| 复用玩法的新 Boss | 新 JSON、新场景与注册项 |
| 新的技巧判定类型 | `SkillType`、校验、`src/ui/skills.ts` 与 `SkillChallenge`；引擎只看结果，无需改动 |
| 新的战斗或调整战斗数值 | `src/game/fights.ts`（登记即可被 JSON 引用），并在 tests/fight.test.ts 的平衡测试中验证 |
| 新的招式或技能 | `src/game/fight.ts`（模拟）、`FightArena`（显示与输入）与平衡测试；引擎只看 HIT／FIGHT_WON，无需改动 |
| 拖拽、物理碰撞等新机制 | 协议、引擎与表现层；另行设计 |

固定的是模块接口，不是永远不变的代码。不兼容协议变更须提升版本并说明迁移方式。

## 3D 与降级

- 场景读取 GameState、当前阶段 cue 和结局；不维护第二套游戏规则。
- 首版打印机由基础几何体搭建，避免依赖尚未取得的模型。
- 离线、队列、卡纸和结局映射独立演出。
- 场景额外接收 `bossHealth`（0–1，或 Boss 出现前为 null），由 Boss 回合进度推导，仅用于表现：每赢一回合盖板开得更大、纸被拉出更多、抖动更强。扣耐心时打印机抖动并向镜头射出一张纸（简化显示中为 CSS 动画）。
- 场景卸载时释放几何体、材质、纹理和动画资源（JSX 创建的对象由 React Three Fiber 释放；手动创建的材质在组件卸载时 dispose）。
- WebGL 不可用、资源失败或上下文丢失时显示简化场景，保留 DOM 行动和完整流程。
- 实现说明：React Three Fiber 卸载渲染器时会调用 `forceContextLoss()`，触发真实的 `webglcontextlost` 事件。SceneCanvas 在自身的 layout effect 清理中先移除监听器，因此主动卸载（如切换简化显示）不会被误报为渲染故障，挂载期间的真实上下文丢失仍会触发降级。
- 移动端限制像素比与特效数量，尊重减少动态效果偏好。性能预算在设备测试后确定。
- 实现说明：Three.js 位于懒加载分包，加载期间显示简化场景；减少动态效果时按需渲染（frameloop="demand"）。

## 验证

规则验证三种结局、无效行动、终局锁定、耐心下限及重开，以及技巧成功／失败分支和 v0.1 兼容。配置验证字段、引用、场景、成功路径和 v0.2 字段。浏览器验证电脑／手机流程、降级，以及用 Playwright 时钟精确控制时间的两种小游戏。视觉效果另行人工验收。
