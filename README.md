# DailyBoss · 人生副本

An open-source browser game that turns everyday frustrations into boss fights.

你只是想打印一张纸，但打印机决定成为今天的最终 Boss。

**在线试玩 / Play now：<https://lachenxuanyu.com/dailyboss/>**

[中文](#中文) · [English](#english)

---

## 中文

浏览器即玩的荒诞生活 Boss 战小游戏：从普通软件界面开始，日常故障逐步升级，界面和 3D 打印机一起进入战斗状态。第二个 Boss「吞币售货机」换成开放的 3D 场地：你操控角色绕着售货机走位、闪躲、从侧面和背后出手。

### 当前状态

第一个可运行版本：首关「地狱打印机」可完整游玩，已部署到 GitHub Pages（<https://lachenxuanyu.com/dailyboss/>）。已有浏览器回归测试与 CI。试玩 #1 反馈「按完按钮什么都没发生」，迭代 1 因此加入了 3 回合 Boss 战；试玩 #2 反馈「不需要技巧，按空格填满进度条就能赢」，迭代 2 因此把三个阶段全部改成**实时战斗**：打印机有预警的攻击招式，玩家用四个技能（闪避、格挡、拽出、重启）分别应对（见下文与 [试玩记录](docs/PLAYTEST.md)）。迭代 5 加入了极限防御、重拽、个人最佳、Boss 练习和音效。当前的迭代 6 加入第二个关卡「吞币售货机」：开放场地的实时战斗、3D 跟随视角与触屏摇杆，标题画面可以在两个副本之间选择。两个关卡都仍需试玩 #6 验证（重玩意愿、技巧发现、售货机的手感与手机帧率）。

**已实现并验证**

- React + TypeScript + Vite 工程，依赖由 `package-lock.json` 锁定。
- 关卡 JSON 运行时校验，错误以「位置 + 原因」的可读列表展示。
- 纯函数规则引擎（`useReducer` 接入）：离线 → 队列 → 卡纸 Boss 战，完美／普通／失败结局、重开、无效行动与终局保护、耐心归零优先判负。
- 协议 v0.4（向后兼容）：关卡可带开场剧情（`intro`）。v0.3 起阶段可以是实时战斗（`fight`），每次被击中扣 1 耐心，打赢后进入 `fight.target`。v0.2 的行动反馈、技巧判定（时机／连打）与阶段强度，以及 v0.1 关卡，都仍可加载。
- 进入游戏（迭代 4）：标题画面（选择副本：地狱打印机或吞币售货机；Boss 立绘、关卡路线、开始游戏与辅助模式）→ 可跳过的开场剧情（逐字显示、带插画）→ 第一场战斗。游戏窗口后是深夜的房间背景，灯光随局势变化（故障升级、Boss 战警报、通关天亮、失败变灰）。
- 重玩理由与技巧空间（迭代 5）：Boss 战加入两个进阶技巧——纸快落地时才闪开、墨粉喷出前一刻才格挡，打印机会在你脚下提前露出破绽；按住 ↑ 重拽，伤害 +1，但按住时不能移动，弱点先缩回会被夹手。结算显示通关时间、被击中次数、个人最佳（本机保存，辅助模式不计入）和一条改进建议；到达过 Boss 后可以直接 Boss 练习。实时合成的音效（可关闭）。背景有秒针、热气、窗外灯光等小动效，有 GPU 时 Boss 战还有警报扫光。
- 第二个 Boss：吞币售货机（迭代 6，`content/levels/vending-machine.json`）。开放场地的纯函数模拟（`src/game/arena.ts`，模拟在 2D 地面上，3D 只负责画）：自由移动、攻击、冲刺（短暂无敌、有冷却）。售货机正面有装甲，只有侧面和背后能打中，打中后它会转身格挡。招式都有地面预警：吐硬币（扇形）、汽水水洼、跳砸、贴身摇晃、朝你倒下（倒地后顶上的饮料成为弱点），以及「系统维护」回血（跑到发光的插座边拔电源打断）。三场战斗（`src/game/arenaFights.ts`）：热身 1 教移动与从背后打，热身 2 教冲刺与拔电源，Boss 战三个形态。脚本玩家平衡测试：反应 350 ms 三场零失误通关，Boss 战约 55 秒；只用 WASD 走、不冲刺的玩家反应 550 ms 也能打过 Boss（试玩 #6 后放宽了摇晃与跳砸的预警）；站着不动、正面狂按、从不躲避、反应 1100 ms 都会输。
- 售货机的画面与操作：战斗开始后铺满整个浏览器窗口，顶部是横跨窗口的售货机血条，角色头顶是耐心格，摇杆和按钮浮在左右下角，暂停菜单里有声音与重开；开战说明仍在面板里。固定斜俯视、跟随玩家的 3D 场地（夜间走廊、地面预警、粒子与震屏，按 GPU／软件渲染／减少动态效果分级），简化显示或无 WebGL 时退回俯视 2D 画面；售货机 3D 立绘、标题 SVG 立绘与四张专属开场插画。键盘 WASD／方向键移动、J 攻击、K／空格冲刺、Esc 暂停；触屏为虚拟摇杆加攻击、冲刺按钮。
- 选择副本：标题画面上用单选组（方向键可切换）在两个关卡之间选择，选择写入地址栏 `?level=` 并记在本机；结算页的「换个副本」回到标题画面。
- 分享结果：结算页的「分享结果」在支持的浏览器上打开系统分享面板；不支持时展开一段已选中的文字和「复制」按钮。文字包含关卡、结局、时间与被击中次数、一句邀请，以及直接打开同一关卡的链接（不带调试参数）。
- 实时战斗（迭代 2）：纯函数、按时间步进的战斗模拟（`src/game/fight.ts`，带种子的随机数，可完全复现）。三条通道；打印机的招式都有预警：纸张砸向发光的通道（闪避 ←/→）、墨粉喷满全屏（按住格挡 ↓，格挡时不能移动）、弱点只在某条通道短暂露出（走过去按 ↑ 拽出，乱拽会被夹手）、「安装更新」充能会回血（按住 K 重启打断，打断后露出大弱点）。两场热身战各教两个技能，Boss 战分三个形态（盖板 → 拔河 → 最后两厘米）逐步叠加招式。初始耐心 5，零失误才是完美结局。
- 平衡由脚本玩家验证（Vitest）：反应 350 ms 的谨慎玩家在 20 个种子下全部零失误通关；站着不动、狂按拽出、一直格挡、乱按所有键都会耗尽耐心；反应 900 ms 打不过 Boss。零失误的 Boss 战约 1 分钟战斗时间。
- Boss 战演出：「BOSS 出现」标题卡、Boss 血条、扣耐心时的反击（纸张飞出、震屏、「−1 耐心」）、每回合递增的损伤、胜利打印纸。
- 战斗操作：键盘（←/→ 或 A/D、↓/S、↑/W/J、K/E，按物理键位识别，输入法开启时也可用）与触屏按钮（点按闪避、拽出；按住格挡、重启）。每场战斗前有技能说明；Esc 或窗口失焦时暂停。辅助模式把战斗放慢到 65%；`?seed=` 固定战斗随机数。
- v0.2 关卡用的技巧小游戏（时机、连打）与行动按钮仍然支持，但当前关卡已不使用，只有单元测试覆盖。
- DOM 操作界面：阶段、目标、耐心、战斗区域、每步反馈、操作记录（含每次被击中）、结算面板；R 重开。
- 界面随故障逐步异变（警示色、扫描线、轻微扭曲），尊重「减少动态效果」设置。
- Three.js／React Three Fiber 几何体打印机，按场景注册表加载；WebGL 不可用、上下文丢失或手动切换时使用简化显示，游戏照常可玩。
- 生产构建使用 GitHub Pages 子路径 `/dailyboss/`。
- Playwright 浏览器测试（94 项）针对 `/dailyboss/` 下的生产构建运行。页面内的脚本玩家只读取战斗区域渲染出的内容并按真实按键，在 Playwright 假时钟下逐帧打完整局。覆盖三种结局、各技能与暂停、触屏按钮、真实 WebGL、上下文丢失、无 WebGL、手机横竖屏视口与减少动态效果；售货机有冒烟测试（键盘与触屏摇杆、3D 场地与简化显示、手机布局、专属开场插画）、脚本玩家用键盘打完整关的测试（页面在 `?probe=1` 时公开战斗状态供它读取），选择副本的测试，以及分享结果（系统分享面板、可复制文字、复制到剪贴板）的测试。
- 修复：手动切换「简化显示」时误报「3D 渲染中断」。
- GitHub Pages 部署：迭代 5 与复审修复已随 [PR #9](https://github.com/ChenXuanyu-1216/dailyboss/pull/9) 合入 `main`；[CI 与 Pages 部署](https://github.com/ChenXuanyu-1216/dailyboss/actions/runs/43899974068) 于 2026-11-16 成功。售货机关卡（模拟、可玩界面、触屏与 3D、3D 美术）随 PR #11–#14 合入 `main`，2026-11-23 检查时线上站点已包含，可用 `?level=vending-machine` 进入。该流程测试生产构建后发布同一份 `dist/`，不等同于线上浏览器回归测试。

**尚未完成**：试玩 #6（两个关卡）、数值调整（2–4 分钟目标）、真机（尤其触屏摇杆与两个 WebGL 画布时的帧率）测试、动画人工验收。详见 [开发路线](docs/ROADMAP.md)。

### 运行

需要 Node.js 20.19 或更高版本（开发时使用 Node 24 / npm 11）。

```bash
npm install
npm run dev          # 开发服务器，http://localhost:5173/
npm run typecheck    # TypeScript 类型检查
npm test             # Vitest：规则、配置校验、反馈文案、小游戏规则与战斗平衡
npm run build        # 类型检查 + 生产构建，输出到 dist/（base 为 /dailyboss/）
npm run preview      # 预览构建结果，http://localhost:4173/dailyboss/
npm run check        # 类型检查 + 测试 + 构建

npx playwright install chromium   # 首次运行浏览器测试前安装 Chromium
npm run test:e2e     # 生产构建 + Playwright 浏览器测试（/dailyboss/）
```

调试参数：`?render=simple` 直接使用简化显示；`?assist=1` 开启辅助模式（战斗放慢到 65%，技巧判定自动成功，也可在界面右下角切换）；`?seed=<整数>` 固定战斗随机数；`?level=<id>` 直接打开已登记的关卡（也可在标题画面选择；未知 ID 会显示配置错误页）；`?practice=1` 直接解锁 Boss 练习；`?sfx=0` 静音；`?bg=off|lite|full` 指定背景动效等级；`?fx=0` 关闭战斗粒子和背景动效。如需其他部署路径，可设置 `BASE_PATH=/其他路径/ npm run build`。

### 自动化测试与 CI

- `npm test`：Vitest 单元测试（`tests/`），规则、配置校验与反馈文案。
- `npm run test:e2e`：先构建，再由 Playwright 启动 `vite preview`，在 `http://127.0.0.1:4173/dailyboss/` 上运行 `e2e/` 中的浏览器测试。`npm run test:e2e:prebuilt` 跳过构建，直接测试现有 `dist/`。
- 标记为 `@webgl` 的测试需要真实 WebGL（无 GPU 时 Chromium 使用 SwiftShader 软件渲染）。环境不支持时这些测试会跳过并注明原因；设置 `E2E_REQUIRE_WEBGL=1` 则改为失败（CI 中已启用）。
- 每个测试都会因意外的 `console.error`、页面异常或 `/dailyboss/` 下资源请求失败而失败。
- 软件 WebGL 很耗 CPU，默认 2 个并行 worker，可用 `E2E_WORKERS` 调整。
- GitHub Actions（`.github/workflows/ci.yml`）：在 Pull Request 和推送到 `main` 时，用 Node 24 和 `npm ci` 依次运行类型检查、单元测试、生产构建和浏览器测试；失败时上传 Playwright 报告。默认只读权限，不使用任何 secret。

### 部署到 GitHub Pages

推送到 `main`（或在 `main` 上手动运行 CI 工作流）且全部检查通过后，`deploy` 任务把**已测试的** `dist/` 发布到 GitHub Pages。Pull Request 永远不会部署。

本仓库已完成以下一次性设置（复刻仓库时需要重做）：

1. **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 若 **Settings → Actions → General** 限制了可用的 Action，需允许 GitHub 官方 Action（`actions/*`）。
3. 可选：在 **Settings → Environments → github-pages** 添加保护规则（如需人工批准）；部署任务会遵守这些规则。
4. 合并到 `main`，或在 **Actions → CI → Run workflow** 中选择 `main` 运行。

站点地址：**<https://lachenxuanyu.com/dailyboss/>**（账号已配置自定义域名，`https://chenxuanyu-1216.github.io/dailyboss/` 会自动跳转）。免费方案下 Pages 要求仓库公开；工作流不会更改仓库可见性。

### MVP 范围

| 项目 | 内容 |
| --- | --- |
| 首关 | Printer From Hell／地狱打印机 |
| 第二关（迭代 6） | 吞币售货机：开放 3D 场地，吞币 → 找零 → 出货失败 Boss 战 |
| 目标 | 打印一张纸 |
| 单局 | 目标 2–4 分钟，待试玩验证 |
| 初始资源 | 耐心值 5（每被击中一次扣 1） |
| 流程 | 离线（热身：闪避、拽出）→ 队列故障（热身：格挡、重启）→ 卡纸 Boss 战（盖板 → 拔河 → 最后两厘米）→ 打印成功 |
| 结局 | 完美、普通、失败；支持重开 |
| 风格 | 普通软件界面逐渐异变成 Boss 战 |
| 平台 | 电脑与手机浏览器，目标部署 GitHub Pages |

首版不包含 AI、账号、后端、数据库、多人模式、排行榜或编辑器。打印机的实时战斗刻意保持小而清楚：三条通道、四个技能、每个技能对应一种招式；售货机用开放场地，但同样只有移动、攻击、冲刺三个操作。两种战斗模拟与规则引擎都是纯函数，动画不决定胜负。

### 固定框架，灵活内容

| 固定部分 | 灵活部分 |
| --- | --- |
| 状态、事件与规则执行接口 | 阶段、行动、耐心消耗和结局文案 |
| 配置校验和加载 | Boss 名称、提示、对白和关卡路径 |
| 通用界面、操作面板与结算 | 主题、图片、音效及模型 |
| 3D 场景适配接口 | 各 Boss 的场景组件与动画 |
| 重开与简化显示机制 | 新关卡内容 |

同类玩法优先改 JSON；新的 3D Boss 需要场景组件。时机与连打判定可直接在 JSON 中通过 `skill` 使用；已登记的实时战斗通过阶段的 `fight` 使用，新的战斗（招式编排与数值）写在 `src/game/fights.ts`（三通道）或 `src/game/arenaFights.ts`（开放场地）中，经 `src/game/fightCatalog.ts` 登记（ID 全局唯一），并用脚本玩家测试平衡；拖拽、物理等超出既有协议的玩法需要扩展引擎，不承诺只改配置就能实现任意玩法。

**新增同类关卡**：在 `content/levels/` 添加 JSON，并在 `src/app/levels.ts` 登记；若需要新 Boss 场景，在 `src/scenes/catalog.ts` 声明 sceneId 与支持的 cue，并在 `src/scenes/registry.ts` 注册组件。视觉风格集中在 `src/styles/tokens.css` 的 CSS 变量中。

### 技术栈

- React 19 + TypeScript 7 + Vite 8：应用与操作界面。
- Three.js 0.187 + React Three Fiber 9：3D Boss、灯光、镜头和动画（按需懒加载）。
- 纯 CSS 与设计变量：软件界面异变与故障反馈。
- useReducer + 纯函数规则执行器：统一游戏状态。
- JSON：独立关卡内容，加载时校验。
- Vitest：规则、配置与反馈测试。
- Playwright：针对生产构建的浏览器测试；GitHub Actions 负责 CI 与 Pages 部署。

### 目录

| 位置 | 职责 |
| --- | --- |
| `content/levels/*.json` | 关卡内容（阶段、行动、数值、文案） |
| `src/game/` | 协议类型、配置校验、纯规则引擎、实时战斗模拟与战斗登记、React 接入 |
| `src/ui/` | 通用 DOM 界面组件与框架文案 |
| `src/scenes/` | 场景白名单、3D 场景（打印机、售货机立绘、开放场地）、简化显示 |
| `src/styles/` | 设计变量与样式 |
| `tests/` | Vitest 单元测试 |
| `e2e/` | Playwright 浏览器测试 |
| `.github/workflows/` | CI 与 Pages 部署 |

### 文档

1. [核心架构与接口](docs/ARCHITECTURE.md)：固定边界和内容协议。
2. [开发阶段与验收](docs/ROADMAP.md)：核心循环 → 完整关卡 → 3D 联动 → 体验与发布。
3. 关卡配置：[地狱打印机](content/levels/printer-from-hell.json)、[吞币售货机](content/levels/vending-machine.json) 的实际运行配置。
4. [试玩记录](docs/PLAYTEST.md)：试玩检查清单与结果模板。

社区 JSON 关卡在 MVP 试玩验证后再推进。关卡中的行动、数值及具体文案是可调整的初始设计。

---

## English

An absurd, browser-playable boss fight about everyday life. It starts as an ordinary printing utility; as the faults escalate, the interface and a 3D printer turn the chore into a boss battle. The second boss, a coin-eating vending machine (吞币售货机), moves to an open 3D arena: you steer a character around the machine, dodge, and strike from the sides and back.

### Status

First runnable version. Level 1, "Printer From Hell" (地狱打印机), is fully playable and deployed to GitHub Pages at <https://lachenxuanyu.com/dailyboss/>. Browser regression tests and CI are in place. Playtest #1 found that "nothing happened" after the buttons were pressed, so Iteration 1 added a 3-round boss fight. Playtest #2 found that it took no skill: you could win by filling a meter with the spacebar. Iteration 2 therefore turns all three phases into **real-time fights**: the printer has telegraphed attacks, and the player answers each one with a specific ability (dodge, block, pull, reset). See below and the [playtest log](docs/PLAYTEST.md). Iteration 5 added precise defence, heavy pulls, personal bests, boss practice and sound. The current Iteration 6 adds a second level, the vending machine: a real-time fight in an open arena, a 3D follow camera and a touch joystick, with a level picker on the title screen. Both levels still need playtest #6: replay interest, whether players discover the techniques, how the vending machine feels, and phone frame rate. The player-facing text is in Chinese.

**Implemented and verified**

- React + TypeScript + Vite project, dependencies pinned by `package-lock.json`.
- Runtime validation of level JSON, with readable errors that give the location and the reason.
- Pure rule engine wired through `useReducer`: offline → queue → paper-jam boss fight. It handles perfect/normal/failure endings, restart, invalid actions and actions after the game ends. Failure takes precedence when patience hits zero.
- Protocol v0.4, backward compatible: a level can carry an opening story (`intro`). Since v0.3 a phase can be a real-time `fight`. Each hit taken costs 1 patience, and winning follows `fight.target`. v0.2 levels (feedback text, timing/mash skill checks, intensity) and v0.1 levels still load.
- Way into the game (Iteration 4): a title screen (pick a level, the printer or the vending machine; boss portrait, the route through the phases, Start and Assist), then a skippable opening story (typed lines with illustrations), then the first fight. Behind the game window is a room late at night whose lighting follows the game: amber as things go wrong, a red alarm in the boss fight, sunrise after a win, grey after a loss.
- Reasons to replay and room for skill (Iteration 5): the boss fight adds two advanced techniques. Step out of the lane just before the sheet lands, or raise the block just before the toner sprays, and the printer exposes an opening under you early. Hold ↑ for a heavy pull worth +1 damage; you can't move while holding, and you get pinched if the weak point retracts first. The results show clear time, hits taken, the personal best (stored in this browser; assist runs don't count) and one tip based on the run. Once you have reached the boss, boss practice starts there directly. Sound effects are synthesised in the browser and can be turned off. The backdrop has small motion (the second hand, steam, city windows), plus an alarm sweep in the boss fight when a GPU is available.
- Second boss: the vending machine (Iteration 6, `content/levels/vending-machine.json`). A pure open-arena simulation (`src/game/arena.ts`) runs on a 2D floor; 3D only draws it. You move freely, attack, and dash (briefly invulnerable, with a cooldown). The machine's front is armoured, so only hits to its sides and back land, and after a hit it turns and guards. Every attack is warned on the floor:
  - coins spat in a fan, and soda puddles that linger;
  - a hop that lands where you stood, and a close-range shake;
  - a topple toward you; once it is down, the drink on top becomes a weak point;
  - "system maintenance" heals it unless you run to the glowing socket and pull the plug.
  Three fights (`src/game/arenaFights.ts`): warm-up 1 teaches moving and hitting from behind, warm-up 2 teaches dashing and pulling the plug, and the boss has three stages. Scripted players check the balance: 350 ms reactions win all three fights without a hit, with a boss fight of about 55 seconds. A player who only walks with WASD and never dashes also beats the boss at 550 ms reactions (the rattle and hop warnings were lengthened after playtest #6). Standing still, mashing at the front, never dodging, and 1100 ms reactions all lose.
- Vending machine view and controls: once a fight starts it fills the whole browser window, with the machine's health as a long bar across the top, the player's patience as segments over the character's head, the stick and buttons in the bottom corners, and sound and restart in the pause menu; the briefing still shows in its panel. A fixed, angled 3D arena camera that follows the player (a night corridor, floor warnings, particles and camera shake, scaled down for software rendering and reduced motion). The simplified display, or no WebGL, falls back to a top-down 2D view. The machine has a 3D portrait, an SVG title portrait and four opening illustrations of its own. Keyboard: WASD or arrows to move, J to attack, K or Space to dash, Escape to pause. Touch: a virtual stick plus attack and dash buttons.
- Level picker: a radio group on the title screen (arrow keys switch) chooses between the two levels. The choice goes into `?level=` and is remembered in this browser, and "换个副本" on the result screen goes back to the title.
- Sharing a result: "分享结果" on the result screen opens the system share sheet where the browser has one. Otherwise it shows the text, already selected, with a copy button. The text gives the level, the ending, the time and hits taken, a dare, and a link that opens the same level (without debug parameters).
- Real-time fights (Iteration 2): a pure, time-stepped simulation (`src/game/fight.ts`) with a seeded RNG, so a seed plus the inputs replays a fight exactly. There are three lanes, and every printer attack is telegraphed. Each one has one answer:
  - paper lands in the lane that glowed: **dodge** with ←/→;
  - toner fills the screen: hold **block** (↓); you can't move while blocking;
  - a weak point sticks out of one lane for a moment: walk there and **pull** (↑); pulling at nothing traps your hand;
  - an "installing update" charge heals the printer: hold **reset** (K) to interrupt it, which exposes a big weak point.
  Two warm-up fights teach two abilities each. The boss has three stages (lid → tug-of-war → last two centimetres) that layer the attacks. Patience starts at 5; only a hitless run is perfect.
- Balance is checked by scripted players in Vitest. A careful player with 350 ms reactions wins every fight without a hit on 20 seeds. Standing still, mashing pull, turtling behind block, and mashing every key all run out of patience, and 900 ms reactions lose to the boss. A hitless boss fight takes about a minute of fight time.
- Boss-fight presentation:
  - a "BOSS 出现" title card and a boss health bar;
  - counterattacks when you lose patience: flying paper, screen shake and a floating "−1 耐心";
  - damage that grows each round, and a victory print.
- Fight controls: keyboard (←/→ or A/D, ↓/S, ↑/W/J, K/E, matched by physical key so they work with an IME on) and touch buttons (tap to dodge and pull; press and hold to block and reset). A briefing before each fight lists the abilities. Escape, or the window losing focus, pauses the fight. Assist mode slows fights to 65%, and `?seed=` fixes the fight RNG.
- The v0.2 timing/mash mini-games and action buttons are still supported for v0.2 levels. The shipped level no longer uses them, so only unit tests cover them now.
- DOM interface: phase, objective, patience, fight arena, feedback after every step, action log (including every hit), and result panel. R restarts.
- The interface degrades step by step as faults escalate (warning colors, scanlines, slight distortion) and respects `prefers-reduced-motion`.
- A primitive-geometry printer built with Three.js / React Three Fiber and loaded through a scene registry. A simplified DOM display takes over when WebGL is unavailable, when the context is lost, or when the player turns it on. The game stays fully playable either way.
- Production builds use the GitHub Pages subpath `/dailyboss/`.
- 94 Playwright browser tests run against the production build under `/dailyboss/`. An in-page scripted player reads only what the arena renders and presses real keys, playing whole runs frame by frame under Playwright's fake clock. They cover:
  - all three endings, every ability, pausing, and touch controls;
  - real WebGL, context loss and no WebGL;
  - mobile portrait and landscape viewports, and reduced motion;
  - smoke tests for the vending machine (keyboard and touch stick, 3D arena and the simplified display, phone layout, its own opening illustrations), a scripted player that beats the whole vending machine level with the keyboard (the page publishes the fight state under `?probe=1` for it), tests for the level picker, and tests for sharing a result (share sheet, copyable text, clipboard).
- Fixed: manually switching to the simplified display no longer reports a false "3D rendering interrupted" warning.
- GitHub Pages deployment: Iteration 5 and its review fixes merged into `main` through [PR #9](https://github.com/ChenXuanyu-1216/dailyboss/pull/9). [CI and the Pages deployment](https://github.com/ChenXuanyu-1216/dailyboss/actions/runs/43899974068) succeeded on 2026-11-16. The vending machine level (simulation, playable UI, touch and 3D, 3D art) merged into `main` through PRs #11–#14; a check on 2026-11-23 found it on the live site, reachable with `?level=vending-machine`. The workflow tests the production build and publishes that same `dist/`; this is not a browser regression run against the live site.

**Not done yet:**
- playtest #6 of both levels, and balance against the 2–4 minute target;
- real-device testing (especially the touch stick, and frame rate with two WebGL canvases on the page);
- manual approval of the animations. See the [roadmap](docs/ROADMAP.md).

### Running it

Requires Node.js 20.19+ (developed with Node 24 / npm 11).

```bash
npm install
npm run dev          # dev server at http://localhost:5173/
npm run typecheck    # TypeScript type check
npm test             # Vitest: rules, config validation, feedback text, mini-games, fight balance
npm run build        # typecheck + production build into dist/ (base /dailyboss/)
npm run preview      # serve the build at http://localhost:4173/dailyboss/
npm run check        # typecheck + tests + build

npx playwright install chromium   # once, before the first browser test run
npm run test:e2e     # production build + Playwright browser tests (/dailyboss/)
```

Debug parameters: `?render=simple` starts in the simplified display. `?assist=1` turns on assist mode, which slows fights to 65% and makes skill checks succeed (there is also a toggle at the bottom right). `?seed=<integer>` fixes the fight RNG. `?level=<id>` opens a registered level directly (the title screen also has a level picker); an unknown ID shows the config error page. `?practice=1` unlocks boss practice, `?sfx=0` mutes, `?bg=off|lite|full` picks the backdrop motion level, and `?fx=0` turns off fight particles and backdrop motion. To deploy under a different path, run `BASE_PATH=/other/ npm run build`.

### Tests and CI

- `npm test`: Vitest unit tests in `tests/` for rules, config validation and feedback text.
- `npm run test:e2e`: builds, then Playwright starts `vite preview` and runs `e2e/` against `http://127.0.0.1:4173/dailyboss/`. `npm run test:e2e:prebuilt` skips the build and tests the existing `dist/`.
- Tests tagged `@webgl` need real WebGL (SwiftShader software rendering in Chromium when there is no GPU). Without WebGL they skip with a reason. With `E2E_REQUIRE_WEBGL=1`, as set in CI, they fail instead.
- Every test fails on an unexpected `console.error`, an uncaught page error, or a failed request for an app asset under `/dailyboss/`.
- Software WebGL is CPU-heavy, so the suite uses 2 parallel workers by default. Change this with `E2E_WORKERS`.
- GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main`. It uses Node 24 and `npm ci` to run the type check, unit tests, production build and browser tests, and uploads the Playwright report on failure. It runs with read-only permissions and uses no secrets.

### Deploying to GitHub Pages

After a push to `main` (or a manual run of the CI workflow on `main`) passes every check, the `deploy` job publishes the **tested** `dist/` to GitHub Pages. Pull requests are never deployed.

This repository has completed the one-time setup below (redo it in a fork):

1. **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
2. If **Settings → Actions → General** restricts which actions may run, allow GitHub-authored actions (`actions/*`).
3. Optional: add protection rules (such as required reviewers) under **Settings → Environments → github-pages**. The deploy job respects them.
4. Merge to `main`, or run **Actions → CI → Run workflow** on `main`.

The site is at **<https://lachenxuanyu.com/dailyboss/>**. The account has a custom domain, so `https://chenxuanyu-1216.github.io/dailyboss/` redirects there. On the free plan, Pages requires a public repository; the workflow never changes repository visibility.

### How it fits together

`content/levels/*.json` → `validateLevel` → `LevelDefinition` → pure `transition()` → `GameState` → DOM UI + 3D scene.

- **Content** (`content/levels/`): phases, actions, costs, and all level text. React components hold no level dialogue.
- **Game** (`src/game/`): protocol types, validation, the pure engine, the pure fight simulation and registered fights, and the `useGame` hook. There are no timers or rendering, and the fight's randomness is a seeded generator in its state, so animation never decides an outcome. The UI owns the clock (`performance.now()` deltas) and the input devices. The engine only sees results: a skill check's `success` or `fail`, and a fight's hits and win.
- **UI** (`src/ui/`): generic, reusable panels and the framework-level labels.
- **Scenes** (`src/scenes/`): a whitelist of `sceneId` → component, the printer scene, the vending machine portrait, the 3D arena, and the fallback display. Scenes only read game state.
- **Styles** (`src/styles/tokens.css`): colors, spacing, type, borders, and motion as CSS variables. Escalation only re-points these tokens.

**Adding a level with the same mechanics:** add a JSON file under `content/levels/` and register it in `src/app/levels.ts`. A new boss scene also needs its cues declared in `src/scenes/catalog.ts` and a component in `src/scenes/registry.ts`. Timing and mash checks are available from JSON through `skill`, and registered real-time fights through a phase's `fight`. New fights (attack scripts and numbers) live in `src/game/fights.ts` (three lanes) or `src/game/arenaFights.ts` (open arena), are registered in `src/game/fightCatalog.ts` (IDs are unique across both), and are balanced against the scripted players. Other new mechanics (drag, physics) need explicit engine changes; there is no scripting system.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Chinese) for the full protocol and rules.

### MVP scope

| Item | Detail |
| --- | --- |
| First level | Printer From Hell / 地狱打印机 |
| Second level (Iteration 6) | Coin-eating vending machine / 吞币售货机: open 3D arena, paying → change → failed-dispense boss fight |
| Goal | Print one page |
| Session | 2–4 minutes target, pending playtests |
| Starting resource | Patience 5 (each hit costs 1) |
| Flow | Offline (warm-up: dodge, pull) → queue failure (warm-up: block, reset) → paper-jam boss fight (lid → tug-of-war → last two centimetres) → printed |
| Endings | Perfect, normal, failure; restart supported |
| Style | An ordinary utility UI mutating into a boss fight |
| Platforms | Desktop and mobile browsers; GitHub Pages target |

Out of scope for v1: AI, accounts, backend, database, multiplayer, leaderboards, or editors. The printer's real-time fight is deliberately small and readable: three lanes and four abilities, each answering one attack. The vending machine uses an open arena but still has only three controls: move, attack and dash. Both fight simulations and the rule engine are pure, and animation never decides an outcome.
