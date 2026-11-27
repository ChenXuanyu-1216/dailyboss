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

### 试玩 #4 — 2026-11-13 前后（由作者于 2026-11-13 转述）/ around 2026-11-13 (reported by the owner on 2026-11-13)

由项目作者转述的一次非正式试玩：几位朋友试玩了迭代 3 的版本（战斗特效与降低难度后的最终形态）。没有按模板逐人记录，下列未知项如实标为「未记录」。

An informal session, reported second-hand by the project owner: a few friends played the Iteration 3 build (fight effects and the easier final form). It was not recorded per player with the template; unknown fields are marked "not recorded".

- 玩家人数 Players: 几位朋友，具体人数未记录 / a few friends, exact number not recorded
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 未记录 / not recorded
- 首局结局 First-run outcome: 未记录 / not recorded
- 令人困惑的选项或反馈 Confusing choices or feedback: 未报告 / none reported
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录；大家都说好玩 / not recorded; everyone said it was fun
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes:
  1. 体验有点单一：一进来就直接和打印机开打，没有像样的引导或进入游戏的过程。/ The experience feels a bit one-note: you are thrown straight into a fight with the printer, with no proper onboarding or way into the game.
  2. 背景很素，看起来像一个廉价的低质量网页游戏。/ The background is very plain, which makes it look like a cheap, low-quality web game.
  3. 没有再提特效或最终形态难度的问题（迭代 3 的改动）；手机帧率仍未测。/ No one raised the effects or the final-form difficulty again (the Iteration 3 changes); phone frame rate is still untested.

**据此做出的改动 / Changes made in response**（迭代 4，见 [ROADMAP.md](ROADMAP.md)）：打开游戏先看到标题画面（游戏名、今日副本、Boss 立绘、目标与耐心、三个阶段的路线、开始游戏和辅助模式），然后是一段可跳过的开场剧情：四段文字逐字打出，配插画（23:47 的钟、写好的文档、「打印机脱机」、睁开的红眼睛），之后才进入第一场战斗。开场文案写在关卡 JSON 里（协议 v0.4 的 `intro`）。游戏窗口外不再是纯色背景，而是深夜的房间：窗外的城市、停在 23:47 的挂钟、圈出截止日的日历、台灯和咖啡；灯光随局势变化（故障升级时偏琥珀色、Boss 战时整个房间变成警报红、通关后天亮、失败后变灰）。房间本身是静止的，动效集中在游戏窗口里。重开时直接回到第一场战斗，不再经过标题。是否解决问题，需要试玩 #5 验证。

Opening the game now shows a title screen first (game name, today's level, a boss portrait, the objective and patience, the route through the three phases, Start and Assist), then a skippable opening story: four lines typed out one at a time with illustrations (a clock at 23:47, the finished document, "Printer offline", red eyes opening), and only then the first fight. The story text lives in the level JSON (the `intro` field, protocol v0.4). Behind the game window, the flat background is replaced by a room late at night: the city outside the window, a wall clock at 23:47, a calendar with the deadline circled, a desk lamp and a coffee. The lighting follows the game: amber as things go wrong, alarm-red in the boss fight, sunrise after a win, grey after a loss. The room itself is static; the motion stays in the game window. Restarting goes straight back to the first fight, not the title. Whether this fixes the problem needs playtest #5.

### 试玩 #5 — 2026-11-15 前后（由作者于 2026-11-15 转述）/ around 2026-11-15 (reported by the owner on 2026-11-15)

几位朋友试玩迭代 4 的版本后给出的一份书面反馈，由作者转述。没有按模板逐人记录，下列未知项如实标为「未记录」。其中有几条（「没有找到音效实现」「试玩历史里既有嫌太简单、也有要求降低最终 Boss 难度」）引用的是项目代码和文档，不只是游玩感受。

Written feedback from a few friends after playing the Iteration 4 build, passed on by the owner. It was not recorded per player with the template; unknown fields are marked "not recorded". A few points ("no game-audio implementation found", "the playtest history has both 'too easy' and 'lower the final boss difficulty'") refer to the project's code and docs, not only to play.

- 玩家人数 Players: 几位朋友，具体人数未记录 / a few friends, exact number not recorded
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 未记录 / not recorded
- 首局结局 First-run outcome: 未记录 / not recorded
- 令人困惑的选项或反馈 Confusing choices or feedback: 车道边界太淡、小字对比度不足 / faint lane boundaries and low-contrast small labels
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录；反馈认为缺少再玩的理由 / not recorded; the feedback says there is little reason to retry
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes:
  1. 玩家在执行指令，而不是做有意思的决定：每种攻击只有一种应对，学会后就没有新发现。建议加入一个有取舍的选择，例如安全的快拽和冒着被反击的风险按住重拽。/ Players execute instructions rather than make interesting decisions: each attack has one answer, and discovery fades once learned. Suggests one meaningful trade-off, e.g. a safe quick pull versus holding longer for extra damage at the risk of a counterattack.
  2. 只有弱点出现在自己的通道时才能攻击，防守再好也只是在等下一次机会。建议精准的闪避或格挡能提前带来破绽。/ You can only deal damage when a weak point opens in your lane, so good defence just means waiting. Suggests precise dodges or blocks should bring an opening forward.
  3. 3D 打印机占了半个窗口，战斗却在旁边的小面板里，像「车道小游戏 + 打印机插图」。/ The 3D printer takes half the window while the fight happens in a separate small panel; it reads as a lane game next to a printer illustration.
  4. 重插 USB、清队列、拽卡纸用的是同一套交互，没有兑现日常故障的荒诞感。/ Reconnecting USB, clearing the queue and pulling paper share one interaction; the absurd premise is under-delivered.
  5. 结算只有「消耗耐心」和「被击中」（在本关是同一个数）和重开；只有一个关卡。建议显示通关时间、个人最佳和一条具体的改进建议，并提供 Boss 练习。/ The results show patience spent and hits taken (the same number in this level) plus Restart, and there is only one level. Suggests clear time, a personal best, one specific tip, and boss practice.
  6. 学习难度和精通难度应该分开：用简短的可玩示例教学，用组合和可选的更难变体挑战熟练玩家。/ Separate learning difficulty from mastery difficulty: teach with short playable examples, challenge experienced players with combinations and optional harder variants.
  7. 没有音效：打印机噪声、充能声、格挡撞击、撕纸声会增强打击感。/ No sound: printer noise, charging, block impacts and a paper tear would improve the sense of contact.
  8. 没有提到迭代 4 的标题画面、开场剧情和背景，因此「开场节奏、背景观感」仍待验证。/ Nothing about Iteration 4's title screen, opening story or backdrop, so those remain unverified.

**据此做出的改动 / Changes made in response**（迭代 5，见 [ROADMAP.md](ROADMAP.md)）：Boss 战加入两个进阶技巧：纸快落地时才闪开、或墨粉喷出前一刻才格挡，打印机会在你脚下提前露出破绽（下一次卡纸随之跳过，所以只加快节奏、不增加总伤害）；按住 ↑ 可以重拽，伤害 +1，但按住时不能移动，弱点先缩回会被夹手。两场热身战保持不变。结算改为显示通关时间、被击中次数、个人最佳、用了几次进阶技巧，以及一条根据本局数据给出的改进建议；到达过 Boss 后可以直接进行 Boss 练习。加入实时合成的音效和声音开关。背景重新加入动效（秒针、热气、窗外灯光、截止日期圈，以及有 GPU 时的警报扫光和琥珀闪烁）。车道分隔线和小字对比度提高。第 3、4 条和可选高难度变体留待后续。是否解决问题，需要试玩 #6 验证。

The boss fight gains two advanced techniques: step out of the lane just before the sheet lands, or raise the block just before the toner sprays, and the printer exposes an opening under you early (the next jam is skipped, so the pace speeds up but total damage stays the same); hold ↑ for a heavy pull worth +1 damage, but you can't move while holding and get pinched if the weak point retracts first. The two warm-up fights are unchanged. The results now show clear time, hits taken, the personal best, how often the advanced techniques were used, and one tip based on the run; once the boss has been reached, boss practice starts straight at the boss. Synthesised sound effects arrive with a sound toggle. The backdrop moves again (the second hand, steam, city windows, the deadline ring, and with a GPU the alarm sweep and amber flicker). Lane lines and small text have more contrast. Points 3 and 4 and an optional harder variant are left for later. Whether this works needs playtest #6.

### 试玩 #6 — 2026-11-26 前后（由作者于 2026-11-26 转述）/ around 2026-11-26 (reported by the owner on 2026-11-26)

作者的一位朋友试玩了带关卡选择的版本，作者转述了一句反馈。没有按模板记录，下列未知项如实标为「未记录」。试玩 #6 原本要验证的其他问题（极限防御与重拽是否被发现、开场节奏、音效、背景、真机帧率）这次都没有涉及，仍待验证。

A friend of the owner played the build with the level picker; the owner passed on one sentence of feedback. It was not recorded with the template; unknown fields are marked "not recorded". The other questions playtest #6 was meant to answer (whether the precise defence and heavy pull are discovered, the opening pacing, sound, backdrop, phone frame rate) were not covered and remain open.

- 玩家人数 Players: 1
- 设备 / 浏览器 Device / browser: 未记录 / not recorded
- 屏幕方向 Orientation: 未记录 / not recorded
- 显示模式 Display: 未记录 / not recorded
- 首局用时 First-run completion time: 未记录 / not recorded
- 首局结局 First-run outcome: 未记录；未能打过售货机 Boss / not recorded; did not get past the vending machine boss
- 令人困惑的选项或反馈 Confusing choices or feedback: 未报告 / none reported
- 是否注意到故障升级 Escalation noticeable?: 未记录 / not recorded
- 是否想再玩 Wanted to replay?: 未记录 / not recorded
- 观察到的问题 Observed bugs: 未报告 / none reported
- 其他备注 Other notes:
  1. 吞币售货机的最终 Boss（第三场战斗）「极难通过，几乎不可能」。/ The vending machine's final boss (its third fight) is "extremely difficult to get past, practically impossible".
  2. 战斗画面应该占满整个浏览器窗口；玩家的血条显示在角色头顶，Boss 的血条是横跨浏览器顶部的长条。（与试玩 #5 第 3 条「战斗区域只是旁边的小面板」一致。）/ The fight should fill the whole browser window, with the player's health bar above the character and the boss's health bar as a long bar across the top of the browser. (Matches playtest #5 point 3: the fight sits in a small side panel.)

**原因分析 / What the numbers showed**：用脚本玩家在 20 个种子下比较（`tests/arenaBot.ts`）。会冲刺的谨慎玩家几乎都能赢，但只用 WASD 走、不冲刺的玩家在 450–750 ms 的反应下 20 局只赢 2–3 局；同样反应下打印机 Boss 在 650 ms 时仍是 20/20。几乎所有被击中都来自两个招式：摇晃（半径 2.8，而攻击要站在约 2.1 以内）和跳砸（落在你站的位置），预警只有 750–850 ms，扣掉人的反应时间后只剩 200–350 ms 走出去。

Scripted players compared over 20 seeds (`tests/arenaBot.ts`). A careful player who dashes nearly always wins, but one who only walks with WASD and never dashes wins just 2–3 of 20 runs at 450–750 ms reactions; the printer boss is still 20/20 at 650 ms. Almost every hit came from two moves: the rattle (radius 2.8, while attacking means standing within about 2.1) and the hop (lands where you stand), warned only 750–850 ms ahead, which leaves 200–350 ms to walk clear after a human reaction.

**据此做出的改动 / Changes made in response**：Boss 的摇晃与跳砸预警按形态改为 1050 → 1000 → 950 ms（原 750–850 ms），摇晃半径 2.8 → 2.6；其他招式、血量和热身战不变。结果：不冲刺的键盘玩家在 550 ms 反应下 20 局全胜、650 ms 下 18 局胜，900 ms 起会输；会冲刺的玩家 900 ms 仍能赢，1100 ms 起全输；从不躲避仍然会输。新的平衡测试固定了这些结论。是否解决问题，需要这位朋友再试一次。

The boss's rattle and hop warnings are now 1050 → 1000 → 950 ms by stage (were 750–850 ms), and the rattle's radius is 2.6 (was 2.8); other moves, HP and the warm-ups are unchanged. A keyboard player who never dashes now wins all 20 runs at 550 ms reactions and 18 at 650 ms, and loses from 900 ms; one who dashes still wins at 900 ms and loses every run from 1100 ms; never dodging still loses. New balance tests pin these down. Whether this fixes it needs the friend to try again.

第 2 条：售货机的战斗一开始就铺满整个浏览器窗口（开战前的说明仍在原来的面板里）。售货机的血量是横跨顶部的长条，旁边是形态名、「简化显示」和「暂停」；玩家的耐心是角色头顶的一排格子（3D 和俯视 2D 都有，最后一格变红）；摇杆和按钮浮在左右下角。暂停菜单里有声音开关和重开，因为页面的标题栏被盖住了。全屏期间后面的页面隐藏，左边的 3D 立绘停止绘制（手机上不再同时绘制两个 WebGL 画面）。竖屏手机上镜头跟得更近。打印机关卡的三通道战斗没有改。

Point 2: a vending machine fight now fills the whole browser window as soon as it starts (the briefing before each fight still shows in its panel). The machine's health is a long bar across the top, next to the stage name, "简化显示" and "暂停"; the player's patience is a row of segments over the character's head (in 3D and in the top-down 2D view; the last one turns red); the stick and buttons float in the bottom corners. The pause menu offers sound and restart, since the page's title bar is covered. Meanwhile the page behind is hidden and its 3D portrait stops drawing (a phone no longer draws two WebGL views at once). On a portrait phone the camera follows more closely. The printer's lane fights are unchanged.
