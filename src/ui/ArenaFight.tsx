import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';
import {
  ARENA_ABILITY_IDS,
  ARENA_RULES,
  arenaHealth,
  canUseArena,
  createArena,
  stepArena,
  type ArenaAttack,
  type ArenaCommand,
  type ArenaEvent,
  type ArenaFightDefinition,
  type ArenaState,
  type Vec,
} from '../game/arena';
import type { ArenaFeedItem } from '../scenes/arenaAnim';
import { SceneErrorBoundary } from '../scenes/SceneErrorBoundary';
import { drawArena } from './arenaDraw';
import { keysVector, knobOffset, stickVector } from './arenaInput';
import { arenaSoundsFor, sfx } from './audio';
import { backdropMotion } from './Backdrop';
import { UI } from './copy';
import { ASSIST_SPEED } from './FightArena';
import { usePrefersReducedMotion } from './hooks';

/** Longest frame delta fed to the simulation; longer gaps (tab switch, debugger) are dropped. */
const MAX_FRAME_MS = 100;
/** How long the last call-out stays emphasised. */
const CALL_MS = 900;
/** The winning blow lands, the arena celebrates, then the game moves on. */
const VICTORY_MS = 1100;
/** How far (px) the thumb travels from the stick's centre for full speed. */
const STICK_RADIUS = 44;

/**
 * `?probe=1`, for browser tests only: publish the fight and its latest state on
 * `window.__arenaProbe` every frame. The floor is drawn on a canvas, so this is how a scripted
 * player in the page (e2e/arenaPageBot.ts) sees the warnings a person would see. Off by default.
 */
const PROBE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('probe') === '1';

export interface ArenaProbe {
  fight: ArenaFightDefinition;
  state: ArenaState;
}

function publishProbe(fight: ArenaFightDefinition, state: ArenaState) {
  (window as unknown as { __arenaProbe?: ArenaProbe }).__arenaProbe = { fight, state };
}

/** The 3D view of the floor; lazy, so Three.js stays out of the main bundle. */
const ArenaScene3D = lazy(() => import('../scenes/ArenaScene3D'));

interface Props {
  fight: ArenaFightDefinition;
  seed: number;
  assist: boolean;
  /** Draw the floor in 3D (WebGL wanted and working); otherwise, or if 3D fails, top-down 2D. */
  render3D?: boolean;
  /** The boss fight shows its HP on the boss bar, so the arena hides its own progress. */
  isBoss: boolean;
  onHit: (attack: ArenaAttack) => void;
  onWon: () => void;
  onHealth: (health: number) => void;
  /** Every frame's events and the fight time it covered (run statistics). */
  onFrame?: (events: readonly ArenaEvent[], dtMs: number) => void;
}

type Dir = 'up' | 'down' | 'left' | 'right';

/** Keyboard map by physical key, so it works with any layout or an active IME. */
function keyAction(e: KeyboardEvent): { dir?: Dir; command?: ArenaCommand } | null {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      return { dir: 'up' };
    case 'ArrowDown':
    case 'KeyS':
      return { dir: 'down' };
    case 'ArrowLeft':
    case 'KeyA':
      return { dir: 'left' };
    case 'ArrowRight':
    case 'KeyD':
      return { dir: 'right' };
    case 'KeyJ':
      return { command: 'attack' };
    case 'KeyK':
    case 'Space':
      return { command: 'dash' };
    default:
      return null;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function callFor(e: ArenaEvent, fight: ArenaFightDefinition): string | null {
  const c = UI.arenaCalls;
  switch (e.type) {
    case 'hit':
      return `${c.hit}${UI.hitLog[e.attack]}。`;
    case 'evade':
      return c.evade;
    case 'damage':
      return e.weak ? c.weakDamage : c.damage;
    case 'clank':
      return c.clank;
    case 'whiff':
      return c.whiff;
    case 'down':
      return c.down;
    case 'up':
      return c.up;
    case 'interrupt':
      return c.interrupt;
    case 'heal':
      return e.amount > 0 ? c.heal : c.healNone;
    case 'stage':
      return fight.stages[e.stage]?.title ?? c.won;
    case 'won':
      return c.won;
    case 'dash':
      return null;
  }
}

/** Calls worth announcing to screen readers (not every evade). */
const ANNOUNCED = new Set<ArenaEvent['type']>(['hit', 'damage', 'down', 'interrupt', 'heal', 'stage', 'won', 'clank']);

/** What a screen reader should hear about new warnings, a new charge, or the boss going down. */
function tacticalCue(before: ArenaState, after: ArenaState, fight: ArenaFightDefinition): string {
  const cues: string[] = [];
  const fresh = after.hazards.filter((h) => h.id >= before.nextId);
  for (const kind of new Set(fresh.map((h) => h.kind))) cues.push(UI.arenaWarn[kind]);
  if (after.charge && after.charge.from !== before.charge?.from) cues.push(UI.arenaChargeCue(fight.copy.charge));
  if (after.down && after.down.from !== before.down?.from) cues.push(UI.arenaDownCue(fight.copy.weakPoint));
  return cues.join(' ');
}

/**
 * One open-arena fight, drawn top-down on a canvas. Owns the clock (performance.now() deltas,
 * scaled in assist mode) and the keyboard; the rules live in src/game/arena.ts. Reports hits,
 * the win and HP changes up, exactly like FightArena does for lane fights.
 */
export function ArenaFight({ fight, seed, assist, render3D = false, isBoss, onHit, onWon, onHealth, onFrame }: Props) {
  const [view, setView] = useState<ArenaState>(() => createArena(fight, seed));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cue, setCue] = useState({ text: '', sequence: 0 });
  const [call, setCall] = useState<{ text: string; tone: string; at: number; announce: boolean } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [failed3D, setFailed3D] = useState(false);
  const on3DFailed = useCallback(() => setFailed3D(true), []);
  const use3D = render3D && !failed3D;
  /** Effects detail for the 3D view: full (GPU), lite (software rendering), off (reduced motion or ?fx=0). */
  const quality = useMemo(() => backdropMotion(reducedMotion), [reducedMotion]);
  /** Simulation steps the 3D view has not drawn yet (it drains this for its effects). */
  const feed = useRef<ArenaFeedItem[]>([]);
  const use3DRef = useRef(use3D);
  use3DRef.current = use3D;
  const winTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(winTimer.current), []);

  const stateRef = useRef(view);
  const commands = useRef<ArenaCommand[]>([]);
  const held = useRef<Record<Dir, Set<string>>>({ up: new Set(), down: new Set(), left: new Set(), right: new Set() });
  /** The touch stick's vector while a pointer holds it (it overrides the keys). */
  const stick = useRef<{ pointer: number; move: Vec } | null>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const lastFrame = useRef<number | null>(null);
  const reported = useRef(false);
  const rootRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const assistRef = useRef(assist);
  assistRef.current = assist;
  const callbacks = useRef({ onHit, onWon, onHealth, onFrame });
  callbacks.current = { onHit, onWon, onHealth, onFrame };

  const running = started && !paused && !view.won;

  const releaseAll = useCallback(() => {
    for (const set of Object.values(held.current)) set.clear();
    stick.current = null;
    if (knobRef.current) knobRef.current.style.transform = '';
    commands.current = [];
  }, []);

  const start = useCallback(() => {
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

  // The machine hums while the fight runs; pausing, winning or leaving silences it.
  useEffect(() => {
    if (!running) return;
    sfx.setHum(isBoss ? 2 : 1);
    return () => sfx.setHum(0);
  }, [running, isBoss]);

  // Draw whenever the state (or the canvas size) changes.
  const draw = useCallback(
    (s: ArenaState) => {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      drawArena(ctx, fight, s, { width: w, height: h, motion: !reducedMotion });
    },
    [fight, reducedMotion, canvas],
  );
  useEffect(() => draw(view), [draw, view]);
  useEffect(() => {
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw(stateRef.current));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw, canvas]);

  // The frame loop.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    if (PROBE) publishProbe(fight, stateRef.current);
    const frame = (now: number) => {
      const prev = lastFrame.current;
      lastFrame.current = now;
      if (prev !== null) {
        const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - prev)) * (assistRef.current ? ASSIST_SPEED : 1);
        const h = held.current;
        const move =
          stick.current?.move ??
          keysVector({ up: h.up.size > 0, down: h.down.size > 0, left: h.left.size > 0, right: h.right.size > 0 });
        const input = { move, commands: commands.current };
        commands.current = [];
        const before = stateRef.current;
        const { state, events } = stepArena(fight, before, input, dt);
        stateRef.current = state;
        if (PROBE) publishProbe(fight, state);
        if (use3DRef.current && feed.current.length < 120) feed.current.push({ before, after: state, events });
        sfx.playAll(arenaSoundsFor(before, state, events));
        flushSync(() => {
          setView(state);
          const text = tacticalCue(before, state, fight);
          if (text) setCue((p) => ({ text, sequence: p.sequence + 1 }));
          const last = [...events].reverse().find((e) => callFor(e, fight) !== null);
          if (last) {
            setCall({ text: callFor(last, fight)!, tone: last.type, at: state.t, announce: ANNOUNCED.has(last.type) });
          }
        });
        callbacks.current.onFrame?.(events, state.t - before.t);
        if (state.hp !== before.hp) callbacks.current.onHealth(arenaHealth(fight, state));
        for (const e of events) {
          if (e.type === 'hit') callbacks.current.onHit(e.attack);
        }
        if (state.won && !reported.current) {
          reported.current = true;
          winTimer.current = window.setTimeout(() => callbacks.current.onWon(), VICTORY_MS);
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
      // Keep Space available for native activation of a focused button.
      if (e.code === 'Space' && e.target instanceof HTMLButtonElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!e.repeat) (paused ? resume : pause)();
        return;
      }
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      if (paused) return;
      if (a.dir) held.current[a.dir].add(e.code);
      if (a.command && !e.repeat) commands.current.push(a.command);
    };
    const onUp = (e: KeyboardEvent) => {
      const a = keyAction(e);
      if (a?.dir) held.current[a.dir].delete(e.code);
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

  // Touch / mouse controls. The stick reads the pointer's offset from its centre while held;
  // the buttons act on press. A keyboard "click" (detail 0) on a focused button also works.
  const stickAt = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    stick.current = { pointer: e.pointerId, move: stickVector(dx, dy, STICK_RADIUS) };
    const k = knobOffset(dx, dy, STICK_RADIUS);
    if (knobRef.current) knobRef.current.style.transform = `translate(${k.x}px, ${k.y}px)`;
  };
  const stickRelease = (e: PointerEvent<HTMLElement>) => {
    if (stick.current?.pointer !== e.pointerId) return;
    stick.current = null;
    if (knobRef.current) knobRef.current.style.transform = '';
  };
  const stickHandlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      if (!running || (stick.current && stick.current.pointer !== e.pointerId)) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      stickAt(e);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (running && stick.current?.pointer === e.pointerId) stickAt(e);
    },
    onPointerUp: stickRelease,
    onPointerCancel: stickRelease,
    onLostPointerCapture: stickRelease,
  };
  const tap = (command: ArenaCommand) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (running) commands.current.push(command);
    },
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0 && running) commands.current.push(command);
    },
  });

  const s = view;
  const t = s.t;
  const stage = fight.stages[s.stage];
  const bannerOn = t < s.stageBannerUntil;
  const callFresh = call !== null && t - call.at < CALL_MS;
  const abilities = ARENA_ABILITY_IDS.filter((a) => canUseArena(fight, a));
  const fresh = abilities.filter((a) => fight.newAbilities.includes(a));
  const known = abilities.filter((a) => !fight.newAbilities.includes(a));
  const ratio = `${fight.floor.halfW * 2} / ${fight.floor.halfH * 2}`;
  const hurt = s.hits > 0 && t < s.invulnerableUntil - ARENA_RULES.invulnerableMs + 250;
  const flat = (
    <canvas ref={setCanvas} className="arena__canvas" role="img" aria-label={UI.arenaFloor} data-testid="arena-canvas" />
  );

  return (
    <section
      ref={rootRef}
      className="panel fight"
      aria-labelledby="fight-heading"
      data-kind="arena"
      data-fight-id={fight.id}
      data-started={started || undefined}
      data-paused={paused || undefined}
      data-player-x={s.pos.x.toFixed(2)}
      data-player-y={s.pos.y.toFixed(2)}
      data-hazards={s.hazards.length}
      data-down={s.down?.cause}
      data-charging={s.charge ? 'true' : undefined}
      data-hits={s.hits}
      data-hp={s.hp}
      data-won={s.won || undefined}
      data-view={use3D ? '3d' : '2d'}
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
          <span className="fight__hp" aria-hidden="true">
            <span className="fight__hp-fill" style={{ transform: `scaleX(${arenaHealth(fight, s)})` }} />
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

      <div className="fight__arena arena__floor" style={{ aspectRatio: ratio }} data-hurt={hurt || undefined}>
        {use3D ? (
          <SceneErrorBoundary onError={on3DFailed} fallback={flat}>
            <Suspense fallback={flat}>
              <div className="arena__canvas" role="img" aria-label={UI.arenaFloor} data-testid="arena-3d">
                <ArenaScene3D
                  def={fight}
                  state={s}
                  feed={feed}
                  quality={quality}
                  reducedMotion={reducedMotion}
                  onContextLost={on3DFailed}
                />
              </div>
            </Suspense>
          </SceneErrorBoundary>
        ) : (
          flat
        )}

        {s.charge && (
          <div className="fight__charge arena__charge">
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

        {bannerOn && stage && (
          <div className="fight__banner" aria-hidden="true">
            <span className="fight__banner-kicker">{UI.fightStageCleared}</span>
            <span className="fight__banner-title">{stage.title}</span>
          </div>
        )}

        {s.won && (
          <div className="fight__victory" aria-hidden="true">
            <span className="fight__victory-title">{isBoss ? UI.fightVictoryBoss : UI.fightVictory}</span>
          </div>
        )}

        {!started && (
          <div className="fight__overlay fight__brief">
            <p className="fight__briefing">{fight.copy.briefing}</p>
            <ul className="fight__kit">
              {known.length > 0 && (
                <li className="fight__kit-known" data-testid="kit-known">
                  {known.map((a) => (
                    <span key={a}>
                      <kbd className="fight__kbd">{UI.arenaKeys[a]}</kbd> {UI.arenaAbility[a]}
                    </span>
                  ))}
                </li>
              )}
              {fresh.map((a) => (
                <li key={a} className="fight__kit-item" data-new>
                  <kbd className="fight__kbd">{UI.arenaKeys[a]}</kbd>
                  <span className="fight__kit-name">
                    {UI.arenaAbility[a]}
                    <span className="fight__new">{UI.fightNewAbility}</span>
                  </span>
                  <span className="fight__kit-help">{UI.arenaHelp[a]}</span>
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

      <div className="arena__controls" role="group" aria-label={UI.arenaControls}>
        <div className="arena__stick" data-testid="arena-stick" role="img" aria-label={UI.arenaStick} {...stickHandlers}>
          <span ref={knobRef} className="arena__knob" aria-hidden="true" />
        </div>
        <div className="arena__buttons">
          {canUseArena(fight, 'dash') && (
            <button
              type="button"
              className="btn fight__ctl arena__btn"
              data-ability="dash"
              data-ready={t >= s.dashReadyAt || undefined}
              aria-keyshortcuts="K Space"
              {...tap('dash')}
            >
              <span className="fight__ctl-icon" aria-hidden="true">
                »
              </span>
              <span className="fight__ctl-name">{UI.arenaAbility.dash}</span>
            </button>
          )}
          <button
            type="button"
            className="btn fight__ctl arena__btn arena__btn--attack"
            data-ability="attack"
            data-ready={t >= s.attackReadyAt || undefined}
            aria-keyshortcuts="J"
            {...tap('attack')}
          >
            <span className="fight__ctl-icon" aria-hidden="true">
              ✊
            </span>
            <span className="fight__ctl-name">{UI.arenaAbility.attack}</span>
          </button>
        </div>
      </div>

      <p className="fight__call" data-tone={callFresh ? call?.tone : undefined} data-testid="fight-call">
        <span key={call?.at ?? 0} className="fight__call-text">
          {call?.text ?? ' '}
        </span>
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
