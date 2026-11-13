import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  LANE_COUNT,
  canUse,
  channelProgress,
  createFight,
  fightHealth,
  stepFight,
  type AbilityId,
  type AttackKind,
  type FightCommand,
  type FightDefinition,
  type FightEvent,
  type FightState,
} from '../game/fight';
import { UI } from './copy';

/** Assist mode runs fight time at this fraction of real time. */
export const ASSIST_SPEED = 0.65;
/** Longest frame delta fed to the simulation; longer gaps (tab switch, debugger) are dropped. */
const MAX_FRAME_MS = 100;
/** How long the last call-out stays emphasised. */
const CALL_MS = 900;

interface Props {
  fight: FightDefinition;
  seed: number;
  assist: boolean;
  /** The boss fight shows its HP on the boss bar, so the arena hides its own progress. */
  isBoss: boolean;
  onHit: (attack: AttackKind) => void;
  onWon: () => void;
  onHealth: (health: number) => void;
}

const ABILITY_LABEL: Record<AbilityId, string> = { dodge: '闪避', block: '格挡', pull: '拽出', reset: '重启' };
const ABILITY_KEYS: Record<AbilityId, string> = { dodge: '← →', block: '↓ 按住', pull: '↑', reset: 'K 按住' };
const ABILITY_HELP: Record<AbilityId, string> = {
  dodge: '离开发光的通道，纸会砸在那里。',
  block: '墨粉喷满全屏，躲不开，只能按住格挡（格挡时不能移动）。',
  pull: '只在弱点露在你所在通道时有效；乱拽会被夹手。',
  reset: '按住约 0.7 秒，打断充能；被打断的打印机会露出大弱点。',
};

type Held = 'block' | 'reset';

function tacticalCue(before: FightState, after: FightState, fight: FightDefinition): string {
  const cues: string[] = [];
  if (after.nextId > before.nextId) {
    const volleys = new Map<number, string[]>();
    for (const paper of after.papers) {
      if (paper.id < before.nextId) continue;
      const lanes = volleys.get(paper.spawnAt) ?? [];
      lanes.push(UI.fightLanes[paper.lane]!);
      volleys.set(paper.spawnAt, lanes);
    }
    for (const lanes of volleys.values()) cues.push(UI.fightPaperCue(lanes.join('、')));
  }
  if (after.toner && after.toner.warnAt !== before.toner?.warnAt) cues.push(UI.fightTonerWarn);
  if (after.toner && before.t < after.toner.activeAt && after.t >= after.toner.activeAt) {
    cues.push(UI.fightTonerActive);
  }
  if (before.toner && !after.toner) cues.push(UI.fightTonerEnd);
  if (after.charge && after.charge.from !== before.charge?.from) cues.push(UI.fightChargeCue(fight.copy.charge));
  if (after.exposure && after.exposure.from !== before.exposure?.from) {
    cues.push(UI.fightWeakCue(UI.fightLanes[after.exposure.lane]!, fight.copy.weakPoint));
  }
  if (cues.length || before.lane !== after.lane) cues.push(UI.fightPosition(UI.fightLanes[after.lane]!));
  return cues.join(' ');
}

/** Keyboard map by physical key, so it works with any layout or an active IME. */
function keyAction(e: KeyboardEvent): { command?: FightCommand; held?: Held } | null {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      return { command: 'left' };
    case 'ArrowRight':
    case 'KeyD':
      return { command: 'right' };
    case 'ArrowUp':
    case 'KeyW':
    case 'KeyJ':
      return { command: 'pull' };
    case 'ArrowDown':
    case 'KeyS':
      return { held: 'block' };
    case 'KeyK':
    case 'KeyE':
      return { held: 'reset' };
    default:
      return null;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function callFor(e: FightEvent, fight: FightDefinition): string | null {
  const c = UI.fightCalls;
  switch (e.type) {
    case 'hit':
      return c.hit[e.attack];
    case 'dodge':
      return c.dodge;
    case 'block':
      return c.block;
    case 'damage':
      return e.stun ? c.stunDamage : c.damage;
    case 'whiff':
      return c.whiff;
    case 'interrupt':
      return c.interrupt;
    case 'reset-wasted':
      return c.resetWasted;
    case 'heal':
      return e.amount > 0 ? c.heal : c.healNone;
    case 'window-missed':
      return c.windowMissed;
    case 'stage':
      return fight.stages[e.stage]?.title ?? c.won;
    case 'won':
      return c.won;
  }
}

/** Calls worth announcing to screen readers (not every dodge). */
const ANNOUNCED = new Set<FightEvent['type']>(['hit', 'damage', 'interrupt', 'heal', 'stage', 'won', 'whiff']);

/**
 * One real-time fight. Owns the clock (performance.now() deltas, scaled in assist mode) and the
 * input devices; the rules live in src/game/fight.ts. Reports hits, the win and HP changes up.
 */
export function FightArena({ fight, seed, assist, isBoss, onHit, onWon, onHealth }: Props) {
  const [view, setView] = useState<FightState>(() => createFight(fight, seed));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cue, setCue] = useState({ text: '', sequence: 0 });
  const [call, setCall] = useState<{ text: string; tone: string; at: number; announce: boolean } | null>(null);

  const stateRef = useRef(view);
  const commands = useRef<FightCommand[]>([]);
  const held = useRef<Record<Held, Set<string>>>({ block: new Set(), reset: new Set() });
  const lastFrame = useRef<number | null>(null);
  const reported = useRef(false);
  const rootRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const assistRef = useRef(assist);
  assistRef.current = assist;
  const callbacks = useRef({ onHit, onWon, onHealth });
  callbacks.current = { onHit, onWon, onHealth };

  const running = started && !paused && !view.won;

  const releaseAll = useCallback(() => {
    held.current.block.clear();
    held.current.reset.clear();
    commands.current = [];
  }, []);

  const start = useCallback(() => {
    setCue({ text: UI.fightPosition(UI.fightLanes[stateRef.current.lane]!), sequence: 1 });
    setStarted(true);
    setPaused(false);
    lastFrame.current = null;
    rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const pause = useCallback(() => {
    releaseAll();
    setPaused(true);
  }, [releaseAll]);

  const resume = useCallback(() => {
    lastFrame.current = null;
    setPaused(false);
  }, []);

  useEffect(() => {
    if (!started) startRef.current?.focus();
  }, [started]);
  useEffect(() => {
    if (paused) resumeRef.current?.focus();
  }, [paused]);

  // The frame loop.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const frame = (now: number) => {
      const prev = lastFrame.current;
      lastFrame.current = now;
      if (prev !== null) {
        const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - prev)) * (assistRef.current ? ASSIST_SPEED : 1);
        const input = {
          commands: commands.current,
          block: held.current.block.size > 0,
          reset: held.current.reset.size > 0,
        };
        commands.current = [];
        const before = stateRef.current;
        const { state, events } = stepFight(fight, before, input, dt);
        stateRef.current = state;
        flushSync(() => {
          setView(state);
          const text = tacticalCue(before, state, fight);
          if (text) setCue((prev) => ({ text, sequence: prev.sequence + 1 }));
          const last = [...events].reverse().find((e) => callFor(e, fight) !== null);
          if (last) {
            setCall({
              text: callFor(last, fight)!,
              tone: last.type,
              at: state.t,
              announce: ANNOUNCED.has(last.type),
            });
          }
        });
        if (state.hp !== before.hp) callbacks.current.onHealth(fightHealth(fight, state));
        for (const e of events) {
          if (e.type === 'hit') callbacks.current.onHit(e.attack);
        }
        if (state.won && !reported.current) {
          reported.current = true;
          callbacks.current.onWon();
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, fight]);

  // Keyboard.
  useEffect(() => {
    if (!started || view.won) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!e.repeat) (paused ? resume : pause)();
        return;
      }
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      if (paused || e.repeat) return;
      if (a.command) commands.current.push(a.command);
      if (a.held) held.current[a.held].add(`key:${e.code}`);
    };
    const onUp = (e: KeyboardEvent) => {
      const a = keyAction(e);
      if (a?.held) held.current[a.held].delete(`key:${e.code}`);
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [started, paused, view.won, pause, resume]);

  // Touch / mouse controls. Pointer presses act immediately; a keyboard "click" (detail 0) on a
  // focused control also works, so the buttons stay operable without a pointer.
  const tap = (command: FightCommand) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (running) commands.current.push(command);
    },
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0 && running) commands.current.push(command);
    },
  });
  const hold = (which: Held) => {
    const release = (e: PointerEvent<HTMLButtonElement>) => held.current[which].delete(`ptr:${e.pointerId}`);
    return {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        if (running) held.current[which].add(`ptr:${e.pointerId}`);
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
    };
  };

  const s = view;
  const t = s.t;
  const stage = fight.stages[s.stage];
  const channel = channelProgress(s);
  const toner = s.toner ? (t >= s.toner.activeAt ? 'active' : 'warn') : undefined;
  const warnLanes = new Set(s.papers.filter((p) => t < p.launchAt).map((p) => p.lane));
  const resetReady = t >= s.resetReadyAt;
  const pullReady = t >= s.pullReadyAt;
  const hurt = t < s.invulnerableUntil && s.hits > 0;
  const bannerOn = t < s.stageBannerUntil;
  const callFresh = call !== null && t - call.at < CALL_MS;
  const abilities = (['dodge', 'block', 'pull', 'reset'] as const).filter((a) => canUse(fight, a));

  return (
    <section
      ref={rootRef}
      className="panel fight"
      aria-labelledby="fight-heading"
      data-fight-id={fight.id}
      data-started={started || undefined}
      data-paused={paused || undefined}
      data-player-lane={s.lane}
      data-blocking={s.blocking || undefined}
      data-channeling={channel !== null || undefined}
      data-toner={toner}
      data-exposed-lane={s.exposure?.lane}
      data-charging={s.charge ? 'true' : undefined}
      data-reset-ready={resetReady || undefined}
      data-pull-ready={pullReady || undefined}
      data-hurt={hurt || undefined}
      data-hits={s.hits}
      data-hp={s.hp}
    >
      <header className="fight__head">
        <h2 id="fight-heading" className="panel__label">
          {stage?.title ?? UI.fightArena}
        </h2>
        {!isBoss && (
          <span className="fight__progress">
            {fight.copy.progress}
            <span className="fight__pips" aria-hidden="true">
              {Array.from({ length: fight.maxHp }, (_, i) => (
                <span key={i} className="fight__pip" data-done={i < fight.maxHp - s.hp || undefined} />
              ))}
            </span>
            <span className="visually-hidden">
              {fight.maxHp - s.hp} / {fight.maxHp}
            </span>
          </span>
        )}
        {isBoss && (
          // Narrow screens scroll the boss bar away during the fight; this mirrors it (CSS shows it there only).
          <span className="fight__hp" aria-hidden="true">
            <span className="fight__hp-fill" style={{ transform: `scaleX(${fightHealth(fight, s)})` }} />
          </span>
        )}
        {started && !s.won && (
          <button
            type="button"
            className="btn btn--ghost btn--small fight__pause"
            onClick={paused ? resume : pause}
            aria-keyshortcuts="Escape"
          >
            {paused ? UI.fightResume : UI.fightPause}
          </button>
        )}
      </header>

      <div className="fight__arena" role="group" aria-label={UI.fightArena}>
        {s.charge && (
          <div className="fight__charge">
            <span className="fight__charge-label">{fight.copy.charge}</span>
            <div
              className="fight__charge-track"
              role="progressbar"
              aria-label={UI.fightCharge}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(((t - s.charge.from) / (s.charge.until - s.charge.from)) * 100)}
            >
              <span
                className="fight__charge-fill"
                style={{ transform: `scaleX(${Math.min(1, (t - s.charge.from) / (s.charge.until - s.charge.from))})` }}
              />
            </div>
          </div>
        )}

        <div className="fight__lanes">
          {Array.from({ length: LANE_COUNT }, (_, lane) => {
            const weak = s.exposure?.lane === lane ? s.exposure : null;
            return (
              <div
                key={lane}
                className="fight__lane"
                data-lane={lane}
                data-warn={warnLanes.has(lane) || undefined}
                data-weak={weak ? (weak.stun ? 'stun' : 'jam') : undefined}
              >
                <span className="fight__slot" aria-hidden="true" />
                {weak && (
                  <span className="fight__weak" data-testid="weak-point">
                    <span className="fight__weak-label">{fight.copy.weakPoint}</span>
                    <span
                      className="fight__weak-timer"
                      style={{ transform: `scaleX(${Math.max(0, (weak.until - t) / (weak.until - weak.from))})` }}
                    />
                  </span>
                )}
                {warnLanes.has(lane) && (
                  <span className="fight__warn" aria-hidden="true">
                    {UI.fightIncoming}
                  </span>
                )}
                {s.papers
                  .filter((p) => p.lane === lane)
                  .map((p) => {
                    const flight = t < p.launchAt ? 0 : (t - p.launchAt) / (p.impactAt - p.launchAt);
                    return (
                      <span
                        key={p.id}
                        className="fight__paper"
                        data-testid="paper"
                        data-lane={lane}
                        data-impact-ms={Math.max(0, Math.round(p.impactAt - t))}
                        data-flying={t >= p.launchAt || undefined}
                        style={{ '--flight': Math.min(1, flight) } as CSSProperties}
                      />
                    );
                  })}
              </div>
            );
          })}
          <div
            className="fight__player"
            style={{ '--lane': s.lane } as CSSProperties}
            data-blocking={s.blocking || undefined}
            data-channeling={channel !== null || undefined}
            data-hurt={hurt || undefined}
            data-locked={!pullReady || undefined}
          >
            <span className="fight__avatar">{UI.fightYou}</span>
            {channel !== null && (
              <span className="fight__channel" style={{ '--channel': channel } as CSSProperties} />
            )}
          </div>
        </div>

        {toner && (
          <div className="fight__toner" data-phase={toner} aria-hidden="true">
            <span>{toner === 'warn' ? UI.fightTonerWarn : UI.fightTonerActive}</span>
          </div>
        )}

        {bannerOn && stage && (
          <div className="fight__banner" aria-hidden="true">
            <span className="fight__banner-kicker">{UI.fightStageCleared}</span>
            <span className="fight__banner-title">{stage.title}</span>
          </div>
        )}

        {!started && (
          <div className="fight__overlay fight__brief">
            <p className="fight__briefing">{fight.copy.briefing}</p>
            <ul className="fight__kit">
              {abilities.map((a) => (
                <li key={a} className="fight__kit-item" data-new={fight.newAbilities.includes(a) || undefined}>
                  <kbd className="fight__kbd">{ABILITY_KEYS[a]}</kbd>
                  <span className="fight__kit-name">
                    {ABILITY_LABEL[a]}
                    {fight.newAbilities.includes(a) && <span className="fight__new">{UI.fightNewAbility}</span>}
                  </span>
                  <span className="fight__kit-help">{ABILITY_HELP[a]}</span>
                </li>
              ))}
            </ul>
            <button ref={startRef} type="button" className="btn btn--primary fight__start" onClick={start}>
              {UI.fightStart}
            </button>
          </div>
        )}

        {started && paused && !s.won && (
          <div className="fight__overlay fight__paused">
            <p className="fight__paused-title">{UI.fightPaused}</p>
            <button ref={resumeRef} type="button" className="btn btn--primary" onClick={resume}>
              {UI.fightResume}
              <kbd className="btn__key btn__key--inline" aria-hidden="true">
                Esc
              </kbd>
            </button>
          </div>
        )}
      </div>

      <div className="fight__controls" role="group" aria-label="技能">
        {canUse(fight, 'dodge') && (
          <button type="button" className="btn fight__ctl" data-ability="left" aria-keyshortcuts="ArrowLeft" {...tap('left')}>
            <span className="fight__ctl-icon" aria-hidden="true">
              ◀
            </span>
            <span className="fight__ctl-name">左闪</span>
          </button>
        )}
        {canUse(fight, 'block') && (
          <button
            type="button"
            className="btn fight__ctl"
            data-ability="block"
            data-active={s.blocking || undefined}
            aria-keyshortcuts="ArrowDown"
            {...hold('block')}
          >
            <span className="fight__ctl-icon" aria-hidden="true">
              ▼
            </span>
            <span className="fight__ctl-name">{s.blocking ? UI.fightBlocking : '格挡'}</span>
          </button>
        )}
        {canUse(fight, 'pull') && (
          <button
            type="button"
            className="btn fight__ctl fight__ctl--pull"
            data-ability="pull"
            data-ready={pullReady || undefined}
            aria-keyshortcuts="ArrowUp"
            {...tap('pull')}
          >
            <span className="fight__ctl-icon" aria-hidden="true">
              ▲
            </span>
            <span className="fight__ctl-name">{pullReady ? '拽出' : UI.fightLocked}</span>
          </button>
        )}
        {canUse(fight, 'reset') && (
          <button
            type="button"
            className="btn fight__ctl"
            data-ability="reset"
            data-active={channel !== null || undefined}
            data-ready={resetReady || undefined}
            aria-keyshortcuts="K"
            {...hold('reset')}
          >
            <span className="fight__ctl-icon" aria-hidden="true">
              ⟳
            </span>
            <span className="fight__ctl-name">
              {channel !== null ? UI.fightChanneling : resetReady ? '重启' : UI.fightCooldown}
            </span>
          </button>
        )}
        {canUse(fight, 'dodge') && (
          <button type="button" className="btn fight__ctl" data-ability="right" aria-keyshortcuts="ArrowRight" {...tap('right')}>
            <span className="fight__ctl-icon" aria-hidden="true">
              ▶
            </span>
            <span className="fight__ctl-name">右闪</span>
          </button>
        )}
      </div>

      <p className="fight__call" data-tone={callFresh ? call?.tone : undefined} data-testid="fight-call">
        {call?.text ?? ' '}
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {call?.announce ? call.text : ''}
      </p>
      <p className="visually-hidden" role="alert" aria-atomic="true">
        <span key={cue.sequence}>{cue.text}</span>
      </p>
    </section>
  );
}
