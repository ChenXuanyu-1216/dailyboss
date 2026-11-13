# 试玩记录 / Playtest Log

用于收集真人试玩证据。数值、文案和单局时长（目标 2–4 分钟）只在有记录后调整。请勿预填或估算结果。

Collects evidence from real players. Balance, copy and the 2–4 minute session target are only adjusted once results exist here. Do not pre-fill or estimate results.

## 试玩前 / Before the session

- [ ] 使用最新的 GitHub Pages 地址，或本地 `npm run build && npm run preview`（`/dailyboss/`）。
      Use the latest Pages URL, or a local `npm run build && npm run preview`.
- [ ] 记录设备、系统、浏览器及版本。Record device, OS, browser and version.
- [ ] 不向玩家解释目标或操作；只说「请完成这个小游戏」。
      Don't explain the goal or the actions; only say "please finish this little game".
- [ ] 从玩家第一次看到页面开始计时，到首个结局出现为止。
      Time from first sight of the page to the first ending.

## 观察要点 / What to watch

- [ ] 玩家是否不读说明也理解目标？Does the player get the goal without instructions?
- [ ] 哪个选项或反馈让人犹豫、误解？Which choices or feedback cause hesitation or confusion?
- [ ] 是否注意到界面和打印机随故障升级而变化？Is the escalation noticeable?
- [ ] 3D 场景是否正常显示；是否切换过简化显示？Did 3D render; was simplified display used?
- [ ] 结局后是否主动想再玩一次？Did they want to replay without prompting?
- [ ] 出现的任何错误、卡顿或布局问题。Any bugs, stutter or layout issues.

## 结果模板 / Results template

复制下面的区块，每位玩家一份。Copy this block once per player.

```markdown
### 试玩 #N — YYYY-MM-DD

- 设备 / 浏览器 Device / browser:
- 屏幕方向 Orientation（竖屏 portrait / 横屏 landscape / 桌面 desktop）:
- 显示模式 Display（3D / 简化 simplified / 自动降级 auto-fallback）:
- 首局用时 First-run completion time（mm:ss）:
- 首局结局 First-run outcome（完美 perfect / 普通 normal / 失败 failure / 未完成 not finished）:
- 令人困惑的选项或反馈 Confusing choices or feedback:
- 是否注意到故障升级 Escalation noticeable?（是 yes / 否 no / 部分 partly）+ 说明 notes:
- 是否想再玩 Wanted to replay?（是 yes / 否 no）+ 原因 why:
- 观察到的问题 Observed bugs（步骤、截图）steps, screenshots:
- 其他备注 Other notes:
```

## 已记录结果 / Recorded results

### 试玩 #1 — 日期未记录（2026-11-11 之前）/ date not recorded (before 2026-11-11)

由项目作者转述的一次非正式试玩：几位朋友试玩了当时线上的 v0.1 版本（3 个阶段、每阶段 2 个按钮）。没有按上面的模板逐人记录，下列未知项如实标为「未记录」。

An informal session, reported second-hand by the project owner: a few friends played the live v0.1 build (3 phases, 2 buttons each). It was not recorded per player with the template above; unknown fields are marked "not recorded".

- 玩家人数 Players: 几位朋友，具体人数未记录 / a few friends, exact number not recorded
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 约 1 分钟 / about 1 minute（低于 2–4 分钟目标 / below the 2–4 minute target）
- 首局结局 First-run outcome: 未记录 / not recorded
- 令人困惑的选项或反馈 Confusing choices or feedback: 按下按钮后「什么都没发生」——只有文字变化，没有战斗感。/ "Nothing happened" after pressing the buttons — only the text changed; it didn't feel like a fight.
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录；玩家表示失望 / not recorded; players said they were disappointed
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes: 玩家期待的是一场「和打印机的史诗级战斗」，实际体验是三次点按钮。/ Players expected "an epic battle against the printer"; what they got was three button presses.

**据此做出的改动 / Changes made in response**（迭代 1，见 [ROADMAP.md](ROADMAP.md)）：保留原 MVP 流程与规则，把卡纸阶段扩展为 3 个 Boss 回合，加入时机与连打两种技巧判定、Boss 血条、反击演出（纸张飞出、震屏、「−1 耐心」）、「BOSS 出现」标题卡、胜利打印纸，以及辅助模式。这些改动是否解决问题，需要试玩 #2 验证。

Iteration 1 keeps the original MVP flow and rules, and expands the paper-jam phase into 3 boss rounds with timing and mash skill checks, a boss health bar, counterattacks (flying paper, screen shake, "−1 耐心"), a "BOSS 出现" title card, a victory print, and an assist mode. Whether this fixes the problem needs playtest #2.

### 试玩 #2 — 2026-11-12 前后（由作者于 2026-11-12 转述）/ around 2026-11-12 (reported by the owner on 2026-11-12)

由项目作者转述的一次非正式试玩：几位朋友试玩了迭代 1 的版本（3 回合卡纸 Boss 战，含时机与连打判定）。没有按模板逐人记录，下列未知项如实标为「未记录」。

An informal session, reported second-hand by the project owner: a few friends played the Iteration 1 build (the 3-round paper-jam boss fight with timing and mash checks). It was not recorded per player with the template; unknown fields are marked "not recorded".

- 玩家人数 Players: 几位朋友，具体人数未记录 / a few friends, exact number not recorded
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 大多数人不到 3 分钟 / most finished in under 3 minutes
- 首局结局 First-run outcome: 未记录；大多数人通关 / not recorded; most finished the game
- 令人困惑的选项或反馈 Confusing choices or feedback: 未报告 / none reported
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录 / not recorded
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes: 玩家认为游戏对技巧和复杂操作几乎没有要求。作为动作游戏，应该要求玩家用特定技能打败 Boss，而不是「按空格填满进度条」就能赢并拿到奖励。/ Players felt the game demanded little skill or complex input. As an action game it should make players use specific abilities to defeat the boss, rather than win by "pressing Space to fill a meter".

**据此做出的改动 / Changes made in response**（迭代 2，见 [ROADMAP.md](ROADMAP.md)）：三个阶段全部改为实时战斗。打印机的招式都有预警，每种招式只有一个对应技能：纸张砸向发光的通道（闪避）、墨粉喷满全屏（按住格挡）、弱点短暂露出（走到那条通道拽出）、「安装更新」充能回血（按住重启打断）。去掉了「蛮力选项」，不再有不靠技巧也能推进的按钮。两场热身战各教两个技能，Boss 战三个形态。初始耐心改为 5，每被击中一次扣 1。是否解决问题，需要试玩 #3 验证。

All three phases are now real-time fights. Every printer attack is telegraphed and has exactly one answer: paper aimed at a glowing lane (dodge), toner across the screen (hold block), a briefly exposed weak point (walk to its lane and pull), and an "installing update" charge that heals (hold reset to interrupt). The brute-force options are gone, so no button advances without skill. Two warm-up fights teach two abilities each, and the boss has three stages. Patience is now 5, and each hit costs 1. Whether this fixes the problem needs playtest #3.

### 试玩 #3 — 2026-11-12（由作者于 2026-11-12 转述）/ 2026-11-12 (reported by the owner on 2026-11-12)

由项目作者转述的一次非正式试玩：作者和几位朋友试玩了迭代 2 的版本（三场实时战斗）。没有按模板逐人记录，下列未知项如实标为「未记录」。

An informal session, reported second-hand by the project owner: the owner and a few friends played the Iteration 2 build (three real-time fights). It was not recorded per player with the template; unknown fields are marked "not recorded".

- 玩家人数 Players: 作者和几位朋友，具体人数未记录 / the owner and a few friends, exact number not recorded
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 未记录 / not recorded
- 首局结局 First-run outcome: 未记录；第三关很难通过 / not recorded; the third fight was very hard to clear
- 令人困惑的选项或反馈 Confusing choices or feedback: 未报告 / none reported
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录 / not recorded
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes:
  1. 墨粉喷射时视觉效果不够。/ Not enough visual effect when the toner sprays.
  2. 整体动画太简单，像一个低质量的小游戏。/ Animations overall are too simple; it feels like a low-quality mini-game.
  3. 第三关 Boss 回血太快，极难通关，希望降低难度。/ The third-level boss heals so fast that the stage is extremely hard to clear; please lower the difficulty.

**据此做出的改动 / Changes made in response**（迭代 3，见 [ROADMAP.md](ROADMAP.md)）：战斗区域加入粒子特效层（墨粉预警时出纸口漏粉、喷射时整片墨粉云和 CMYK 墨点、被喷中时屏幕上的墨渍、格挡时墨粉从护盾上弹开），以及震屏、闪光、纸张飞行与落地碎纸、拽出时的火花和伤害数字、打断时的冲击波、形态横幅与胜利演出，3D 打印机被打中时会后仰。Boss 最终形态的「固件更新」改为 7 秒回 1 血（原 5 秒回 2 血），且不会回到超过该形态起始血量；更新开始后有一段空档用来按住重启；每轮多一次卡纸机会。脚本玩家测试中，完全不会打断更新的玩家现在约 35 秒打完最终形态（原来永远打不过）。是否解决问题，需要试玩 #4 验证。

The arena gains a particle-effects layer (slots leaking toner during the warning, a full toner cloud with CMYK droplets during the spray, ink splats on the screen when hit, toner bouncing off the shield when blocking), plus screen shake, flashes, paper flight and shredding, sparks and damage numbers on pulls, a shockwave on interrupts, stage banners and a victory beat; the 3D printer recoils when hit. The boss's final-form "firmware update" now heals 1 HP over 7 s (was 2 HP over 5 s) and can never heal above that stage's starting HP; a quiet beat after it starts leaves room to hold reset, and each cycle has one more jam. In scripted-player tests a player who never interrupts the update now clears the final form in about 35 s (before: never). Whether this fixes the problem needs playtest #4.
