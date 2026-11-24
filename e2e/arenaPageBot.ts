import type { ArenaProbe } from '../src/ui/ArenaFight';
import { arenaSkilledPolicy, type ArenaPolicy } from '../tests/arenaBot';

/**
 * The open-arena scripted player, run *inside the page*. e2e/arena.spec.ts bundles this file
 * (with tests/arenaBot.ts and the simulation it imports) into one script and adds it to the page.
 *
 * Each animation frame it reads the fight the page published under `?probe=1`, asks the same
 * careful policy the Vitest balance tests use (it only reacts to warnings it has "seen", after
 * its reaction time), and turns the answer into real KeyboardEvents on window: WASD held for the
 * direction (so movement is limited to 8 directions, like a person on a keyboard), J for attack
 * and K for dash.
 */

const MOVE_THRESHOLD = 0.38;
const DIR_KEYS = { right: 'KeyD', left: 'KeyA', up: 'KeyW', down: 'KeyS' } as const;

function install(reactionMs = 250) {
  const w = window as unknown as { __arenaProbe?: ArenaProbe; __arenaBotInstalled?: boolean };
  if (w.__arenaBotInstalled) return;
  w.__arenaBotInstalled = true;

  const held = new Set<string>();
  let fightId: string | null = null;
  let policy: ArenaPolicy | null = null;
  let mem: Record<string, number> = {};
  let lastT = -1;

  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  const hold = (code: string, on: boolean) => {
    if (on === held.has(code)) return;
    if (on) held.add(code);
    else held.delete(code);
    key(on ? 'keydown' : 'keyup', code);
  };
  const releaseAll = () => {
    for (const code of Object.values(DIR_KEYS)) hold(code, false);
  };
  const tap = (code: string) => {
    key('keydown', code);
    key('keyup', code);
  };

  const tick = () => {
    requestAnimationFrame(tick);
    const el = document.querySelector<HTMLElement>('.fight[data-kind="arena"]');
    const probe = w.__arenaProbe;
    if (!el || !el.dataset.started || el.dataset.paused || el.dataset.won || !probe || probe.fight.id !== el.dataset.fightId) {
      releaseAll();
      return;
    }
    if (probe.fight.id !== fightId) {
      fightId = probe.fight.id;
      policy = arenaSkilledPolicy(probe.fight, reactionMs);
      mem = {};
      lastT = -1;
    }
    const s = probe.state;
    // One decision per simulation step (the page may draw a frame without stepping).
    if (s.t === lastT) return;
    lastT = s.t;
    const { move, commands } = policy!(s, mem);
    hold(DIR_KEYS.right, move.x > MOVE_THRESHOLD);
    hold(DIR_KEYS.left, move.x < -MOVE_THRESHOLD);
    hold(DIR_KEYS.up, move.y > MOVE_THRESHOLD);
    hold(DIR_KEYS.down, move.y < -MOVE_THRESHOLD);
    for (const c of commands) tap(c === 'attack' ? 'KeyJ' : 'KeyK');
  };
  requestAnimationFrame(tick);
}

(window as unknown as { installArenaBot: typeof install }).installArenaBot = install;
