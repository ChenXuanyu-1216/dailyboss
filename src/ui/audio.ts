import { useSyncExternalStore } from 'react';
import type { ArenaEvent, ArenaState } from '../game/arena';
import type { FightEvent, FightState } from '../game/fight';

/**
 * Game sound, synthesised with the Web Audio API: no audio files to download, and every sound is
 * a few oscillators or a burst of filtered noise. Presentation only, like the particle layer: it
 * reads fight state and events and never feeds anything back.
 *
 * The AudioContext is created on the first key press or tap (browsers block sound before that).
 * Sound is on by default; the choice is remembered in localStorage. `?sfx=0` turns it off for the
 * page (tests, or a quick way out of a noisy tab).
 */

export type SoundId =
  | 'telegraph'
  | 'launch'
  | 'dodge'
  | 'hit-paper'
  | 'toner-warn'
  | 'toner-spray'
  | 'hit-toner'
  | 'block'
  | 'weak'
  | 'pull'
  | 'pull-heavy'
  | 'grip'
  | 'whiff'
  | 'pinch'
  | 'charge'
  | 'interrupt'
  | 'heal'
  | 'perfect'
  | 'stage'
  | 'won';

/**
 * What a fight step sounds like: derived from the state change and the step's events. Pure, so
 * the mapping is unit-tested without an AudioContext.
 */
export function soundsFor(before: FightState, after: FightState, events: readonly FightEvent[]): SoundId[] {
  const out: SoundId[] = [];
  if (after.nextId > before.nextId) out.push('telegraph');
  if (after.papers.some((p) => before.t < p.launchAt && after.t >= p.launchAt)) out.push('launch');
  if (after.toner && after.toner.warnAt !== before.toner?.warnAt) out.push('toner-warn');
  if (after.toner && before.t < after.toner.activeAt && after.t >= after.toner.activeAt) out.push('toner-spray');
  if (after.exposure && after.exposure.from !== before.exposure?.from) out.push('weak');
  if (after.charge && after.charge.from !== before.charge?.from) out.push('charge');
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        out.push(e.attack === 'toner' ? 'hit-toner' : e.attack === 'pinch' ? 'pinch' : 'hit-paper');
        break;
      case 'dodge':
        out.push('dodge');
        break;
      case 'block':
        out.push('block');
        break;
      case 'damage':
        out.push(e.heavy ? 'pull-heavy' : 'pull');
        break;
      case 'grip':
        out.push('grip');
        break;
      case 'whiff':
        out.push('whiff');
        break;
      case 'interrupt':
        out.push('interrupt');
        break;
      case 'heal':
        if (e.amount > 0) out.push('heal');
        break;
      case 'perfect':
        if (e.opened) out.push('perfect');
        break;
      case 'stage':
        out.push('stage');
        break;
      case 'won':
        out.push('won');
        break;
      default:
        break;
    }
  }
  return out;
}

/** The arena counterpart of `soundsFor` (open-arena fights reuse the same synthesised sounds). */
export function arenaSoundsFor(before: ArenaState, after: ArenaState, events: readonly ArenaEvent[]): SoundId[] {
  const out: SoundId[] = [];
  if (after.nextId > before.nextId) out.push('telegraph');
  for (const h of after.hazards) {
    if (before.t < h.activeAt && after.t >= h.activeAt) out.push(h.kind === 'soda' ? 'toner-spray' : 'launch');
  }
  if (after.charge && after.charge.from !== before.charge?.from) out.push('charge');
  for (const e of events) {
    switch (e.type) {
      case 'hit':
        out.push(e.attack === 'soda' ? 'hit-toner' : 'hit-paper');
        break;
      case 'evade':
      case 'dash':
        out.push('dodge');
        break;
      case 'clank':
        out.push('block');
        break;
      case 'damage':
        out.push(e.weak ? 'pull-heavy' : 'pull');
        break;
      case 'whiff':
        out.push('whiff');
        break;
      case 'down':
        out.push('weak');
        break;
      case 'interrupt':
        out.push('interrupt');
        break;
      case 'heal':
        if (e.amount > 0) out.push('heal');
        break;
      case 'stage':
        out.push('stage');
        break;
      case 'won':
        out.push('won');
        break;
      default:
        break;
    }
  }
  return out;
}

const STORAGE_KEY = 'dailyboss:sound';

function initiallyOn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('sfx') === '0') return false;
  } catch {
    // ignore
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

type Ctx = AudioContext;

class Sfx {
  on = initiallyOn();
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: { osc: OscillatorNode; gain: GainNode } | null = null;
  private humLevel = 0;
  private chargeVoice: { osc: OscillatorNode; gain: GainNode } | null = null;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setOn(on: boolean): void {
    this.on = on;
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // ignore
    }
    if (on) this.unlock();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.02);
    this.listeners.forEach((fn) => fn());
  }

  /** Creates or resumes the AudioContext. Call from a user gesture. */
  unlock(): void {
    if (!this.on) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private ready(): Ctx | null {
    if (!this.on || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  /** A tone with a pitch sweep and an attack/decay envelope. */
  private tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, at = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise; `crackle` chops it into a tearing-paper rasp. */
  private hiss(
    filter: BiquadFilterType,
    from: number,
    to: number,
    dur: number,
    vol: number,
    { q = 1, crackle = 0, attack = 0.005, at = 0 }: { q?: number; crackle?: number; attack?: number; at?: number } = {},
  ): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (crackle > 0) {
      // Random dips in level: the fibres giving way one by one.
      const steps = Math.floor(dur / 0.018);
      for (let i = 1; i < steps; i++) {
        gain.gain.setValueAtTime(vol * (Math.random() < crackle ? 0.15 : 0.6 + Math.random() * 0.4), t + i * 0.018);
      }
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(id: SoundId): void {
    if (!this.ready()) return;
    switch (id) {
      case 'telegraph': // the paper feed winding up
        this.tone('square', 180, 260, 0.12, 0.035);
        this.hiss('bandpass', 1400, 1800, 0.12, 0.05, { q: 3 });
        break;
      case 'launch':
        this.hiss('bandpass', 2600, 700, 0.2, 0.12, { q: 1.5 });
        break;
      case 'dodge':
        this.hiss('highpass', 3000, 5000, 0.12, 0.05);
        break;
      case 'hit-paper':
        this.tone('sine', 150, 55, 0.18, 0.35);
        this.hiss('lowpass', 2500, 400, 0.1, 0.2);
        break;
      case 'toner-warn': // the cartridge starts to leak
        this.hiss('highpass', 4000, 2500, 0.55, 0.06, { attack: 0.4 });
        break;
      case 'toner-spray':
        this.hiss('lowpass', 1400, 500, 0.7, 0.22, { attack: 0.02 });
        break;
      case 'hit-toner':
        this.hiss('lowpass', 500, 200, 0.3, 0.3);
        this.tone('sine', 110, 70, 0.25, 0.2);
        break;
      case 'block': // toner rattling off the shield
        this.tone('triangle', 620, 420, 0.14, 0.18);
        this.hiss('bandpass', 1800, 1200, 0.2, 0.08, { q: 4, crackle: 0.4 });
        break;
      case 'weak':
        this.tone('sine', 480, 820, 0.09, 0.12);
        break;
      case 'pull': // a satisfying paper tear
        this.hiss('bandpass', 3200, 1600, 0.24, 0.3, { q: 1.2, crackle: 0.35 });
        break;
      case 'pull-heavy':
        this.hiss('bandpass', 2600, 900, 0.5, 0.38, { q: 1, crackle: 0.3 });
        this.tone('sine', 120, 45, 0.35, 0.35, 0.05);
        break;
      case 'grip': // the paper straining
        this.tone('sawtooth', 70, 120, 0.6, 0.03);
        break;
      case 'whiff':
        this.tone('square', 95, 70, 0.07, 0.08);
        break;
      case 'pinch':
        this.hiss('highpass', 3000, 1500, 0.06, 0.3);
        this.tone('square', 220, 70, 0.18, 0.12);
        break;
      case 'charge':
        this.startCharge();
        break;
      case 'interrupt': // reset: a power-down zap
        this.stopCharge();
        this.tone('sawtooth', 1200, 90, 0.3, 0.12);
        break;
      case 'heal':
        this.stopCharge();
        this.tone('sine', 660, 660, 0.12, 0.12);
        this.tone('sine', 990, 990, 0.2, 0.12, 0.1);
        break;
      case 'perfect':
        this.tone('sine', 1320, 1320, 0.35, 0.12);
        this.tone('sine', 1980, 1980, 0.3, 0.06, 0.02);
        break;
      case 'stage':
        this.stopCharge();
        this.tone('sine', 90, 38, 0.7, 0.45);
        this.hiss('lowpass', 800, 100, 0.6, 0.2);
        break;
      case 'won':
        this.stopCharge();
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.16, i * 0.09));
        break;
    }
  }

  playAll(ids: readonly SoundId[]): void {
    for (const id of ids) this.play(id);
  }

  /** The "installing update" whine: rises until interrupted or finished. */
  private startCharge(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.stopCharge();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.linearRampToValueAtTime(900, t + 7);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.3);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 8);
    this.chargeVoice = { osc, gain };
  }

  stopCharge(): void {
    const v = this.chargeVoice;
    this.chargeVoice = null;
    if (!v || !this.ctx) return;
    try {
      v.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
      v.osc.stop(this.ctx.currentTime + 0.15);
    } catch {
      // already stopped
    }
  }

  /** The printer's motor hum while a fight runs; louder in the boss fight. 0 = off. */
  setHum(level: number): void {
    if (level === this.humLevel && (level === 0 || this.hum)) return;
    this.humLevel = level;
    const ctx = this.ready();
    if (level === 0 || !ctx) {
      if (this.hum && this.ctx) {
        this.hum.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
        this.hum.osc.stop(this.ctx.currentTime + 0.6);
      }
      this.hum = null;
      this.stopCharge();
      return;
    }
    if (!this.hum) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const f = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      f.type = 'lowpass';
      f.frequency.value = 180;
      gain.gain.value = 0.0001;
      osc.connect(f).connect(gain).connect(this.master!);
      osc.start();
      this.hum = { osc, gain };
    }
    this.hum.osc.frequency.setTargetAtTime(level > 1 ? 62 : 55, ctx.currentTime, 0.3);
    this.hum.gain.gain.setTargetAtTime(level > 1 ? 0.05 : 0.03, ctx.currentTime, 0.3);
  }
}

export const sfx = new Sfx();

if (typeof window !== 'undefined') {
  // Browsers only allow audio after a user gesture; the first one unlocks it for the page.
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

/** Whether sound is on, kept in sync with every toggle. */
export function useSoundOn(): [boolean, () => void] {
  const on = useSyncExternalStore(
    (fn) => sfx.subscribe(fn),
    () => sfx.on,
    () => false,
  );
  return [on, () => sfx.setOn(!sfx.on)];
}
