import { LANE_COUNT, type FightEvent, type FightState } from '../game/fight';

/**
 * Particle effects for the fight arena (canvas 2D). Presentation only: it reads fight state and
 * events after the simulation has stepped and never feeds anything back, so randomness and frame
 * timing here cannot change an outcome.
 *
 * Coordinates are CSS pixels of the arena box. Positions mirror fight.css: lanes are thirds, the
 * printer's slots sit on the top edge, the player's avatar is centred PLAYER_Y above the bottom.
 */

type Kind = 'smoke' | 'drop' | 'shred' | 'spark' | 'ring' | 'text' | 'splat' | 'glint' | 'streak' | 'ghost';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** Lifetime in seconds. */
  life: number;
  size: number;
  /** Size change per second. */
  grow: number;
  rot: number;
  vr: number;
  /** Velocity kept per second (1 = no drag). */
  drag: number;
  gravity: number;
  color: string;
  alpha: number;
  seed: number;
  text?: string;
  blobs?: { dx: number; dy: number; r: number }[];
  drips?: { dx: number; w: number; len: number }[];
}

/** Centre of the avatar above the arena's bottom edge (fight.css: bottom 34px + 42px / 2). */
const PLAYER_Y = 55;
/** Where a falling sheet meets the player row. */
const IMPACT_Y = 78;
/** Radius of the block shield dome, and its centre above the bottom edge (fight.css .fight__shield). */
const SHIELD_R = 62;
const SHIELD_Y = 46;
/** Weak point centre below the top edge. */
const WEAK_Y = 30;

const MAX_PARTICLES = 650;
/** Smoke dominates fill-rate (big alpha sprites), so it has its own, smaller budget. */
const MAX_SMOKE = 140;

/** Process-colour toner: what a real cartridge sprays. */
const CMYK = ['#1fc8ff', '#ff3d9a', '#ffd23f', '#14100f'];
/** Toner cloud: mostly near-black, with a few lighter billows that give it volume. */
const SMOKE = ['#0c090d', '#241d27', '#3a3140', '#544a5a', '#6f6476', '#8a7f8f'];
const CONFETTI = ['#fbfbf8', '#1fc8ff', '#ff3d9a', '#ffd23f', '#3ad07a', '#f5a524'];
const FONT = "'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** '#rrggbb' at `alpha`. */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

function particle(kind: Kind, x: number, y: number, over: Partial<Particle>): Particle {
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1,
    size: 4,
    grow: 0,
    rot: 0,
    vr: 0,
    drag: 1,
    gravity: 0,
    color: '#ffffff',
    alpha: 1,
    seed: Math.random() * 1000,
    ...over,
  };
}

export class FightFx {
  w = 0;
  h = 0;
  particles: Particle[] = [];
  /** Latest fight state, for the continuous emitters. */
  private state: FightState | null = null;
  /** Fractional particle counts carried between frames, per emitter. */
  private carry: Record<string, number> = {};
  private sprites = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
  private lastLane: number | null = null;
  /**
   * Emission multiplier in [0.35, 1]. The layer lowers it when frames take too long to draw
   * (slow phones, software rendering) and lets it recover when there is headroom.
   */
  quality = 1;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  /** True while anything is still on screen or being emitted. */
  get busy(): boolean {
    return this.particles.length > 0 || this.emitting();
  }

  laneX(lane: number): number {
    return ((lane + 0.5) * this.w) / LANE_COUNT;
  }

  get playerY(): number {
    return this.h - PLAYER_Y;
  }

  /** Called once per simulation frame with the states either side of the step. */
  sync(before: FightState, after: FightState, events: readonly FightEvent[]): void {
    this.state = after;
    if (this.w === 0) return;

    if (this.lastLane !== null && after.lane !== this.lastLane) this.dash(this.lastLane, after.lane);
    this.lastLane = after.lane;

    // Sheets that landed this step, with the lane they landed in.
    const landed = before.papers.filter((p) => p.impactAt <= after.t && !after.papers.some((q) => q.id === p.id));
    const hitPaper = events.some((e) => e.type === 'hit' && e.attack === 'paper');
    for (const p of landed) {
      delete this.carry[`slot${p.id}`];
      delete this.carry[`trail${p.id}`];
      if (hitPaper && p.lane === after.lane) this.paperHit(p.lane);
      else this.paperShred(p.lane);
    }

    if (after.toner && before.t < after.toner.activeAt && after.t >= after.toner.activeAt) this.tonerBlast();
    if (before.toner && !after.toner) this.dissipate();

    for (const e of events) {
      switch (e.type) {
        case 'hit':
          if (e.attack === 'toner') this.tonerHit(after.lane);
          this.text(this.laneX(after.lane), this.playerY - 40, '−1 耐心', '#ff6b6b', 20);
          break;
        case 'block':
          this.blocked(after.lane);
          break;
        case 'damage': {
          const lane = before.exposure?.lane ?? after.lane;
          this.yank(lane, e.amount, e.stun);
          break;
        }
        case 'whiff':
          this.whiff(after.lane);
          break;
        case 'interrupt':
          this.interrupt();
          break;
        case 'reset-wasted':
          this.puff(this.laneX(after.lane), this.playerY, '#8a8189', 8);
          break;
        case 'heal':
          if (e.amount > 0) this.heal(e.amount);
          break;
        case 'window-missed':
          if (before.exposure) this.puff(this.laneX(before.exposure.lane), WEAK_Y, '#8a8189', 10);
          break;
        case 'stage':
          this.stage();
          break;
        case 'won':
          this.won();
          break;
        case 'dodge':
          break;
      }
    }
  }

  /** Advances every particle by `dt` seconds and runs the continuous emitters. */
  step(dt: number): void {
    if (dt <= 0) return;
    this.emit(dt);
    const s = this.state;
    const shield = s?.blocking ? { x: this.laneX(s.lane), y: this.h - SHIELD_Y } : null;
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const drag = p.drag === 1 ? 1 : Math.pow(p.drag, dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      if (p.kind === 'shred') p.vx += Math.sin(p.age * 9 + p.seed) * 220 * dt;
      if (p.kind === 'smoke') p.vx += Math.sin(p.age * 3 + p.seed) * 40 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Toner that reaches the floor rolls outward instead of falling through it.
      if (p.kind === 'smoke' && p.vy > 0 && p.y > this.h - 18) {
        p.y = this.h - 18;
        p.vx += (p.x < this.w / 2 ? -1 : 1) * p.vy * 0.5;
        p.vy *= -0.15;
      }
      p.rot += p.vr * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
      if (shield && (p.kind === 'smoke' || p.kind === 'drop')) this.deflect(p, shield);
      keep.push(p);
    }
    this.particles = keep;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.w, this.h);
    // Soft things first, bright things on top.
    for (const p of this.particles) if (p.kind === 'smoke' || p.kind === 'splat' || p.kind === 'ghost') this.drawOne(ctx, p);
    for (const p of this.particles) if (p.kind === 'drop' || p.kind === 'shred' || p.kind === 'streak') this.drawOne(ctx, p);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) if (p.kind === 'spark' || p.kind === 'glint' || p.kind === 'ring') this.drawOne(ctx, p);
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) if (p.kind === 'text') this.drawOne(ctx, p);
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles = [];
    this.state = null;
    this.lastLane = null;
    this.carry = {};
  }

  // -------------------------------------------------------------------------
  // Continuous emitters (driven by the latest state)
  // -------------------------------------------------------------------------

  private emitting(): boolean {
    const s = this.state;
    if (!s || s.won) return false;
    return !!(s.toner || s.charge || s.exposure || s.channelFrom !== null || s.papers.length);
  }

  /** Emits `rate` per second, carrying fractions between frames. */
  private count(key: string, rate: number, dt: number): number {
    const n = (this.carry[key] ?? 0) + rate * this.quality * dt;
    const whole = Math.floor(n);
    this.carry[key] = n - whole;
    return whole;
  }

  private emit(dt: number): void {
    const s = this.state;
    if (!s || s.won || this.w === 0) return;
    const { w, h } = this;
    const t = s.t;
    let smoke = 0;
    for (const p of this.particles) if (p.kind === 'smoke') smoke++;

    // Toner wind-up: the slots leak and spit, harder as the spray gets closer.
    if (s.toner && t < s.toner.activeAt) {
      const k = Math.min(1, (t - s.toner.warnAt) / Math.max(1, s.toner.activeAt - s.toner.warnAt));
      for (let i = this.count('leak', 18 + 70 * k * k, dt); i > 0; i--) {
        const x = this.laneX(Math.floor(Math.random() * LANE_COUNT)) + rand(-0.12, 0.12) * w;
        this.add(particle('smoke', x, rand(4, 10), {
          vx: rand(-20, 20), vy: rand(30, 90 + 120 * k), life: rand(0.5, 0.9), size: rand(6, 12), grow: rand(18, 40),
          color: pick(SMOKE), alpha: 0.55, drag: 0.4,
        }));
      }
      for (let i = this.count('spit', 6 + 30 * k, dt); i > 0; i--) {
        const x = this.laneX(Math.floor(Math.random() * LANE_COUNT)) + rand(-0.1, 0.1) * w;
        this.add(particle('drop', x, 8, {
          vx: rand(-60, 60), vy: rand(60, 200), gravity: 900, life: rand(0.35, 0.7), size: rand(1.2, 2.4), color: pick(CMYK),
        }));
      }
    }

    // Toner spray: a billowing cloud and a hail of process-colour droplets across every lane.
    if (s.toner && t >= s.toner.activeAt) {
      for (let i = this.count('cloud', 85, dt); i > 0 && smoke < MAX_SMOKE; i--, smoke++) this.tonerPuff();
      for (let i = this.count('hail', 140, dt); i > 0; i--) {
        this.add(particle('drop', rand(0, w), rand(-6, 10), {
          vx: rand(-90, 90), vy: rand(420, 760), gravity: 500, life: rand(0.4, 0.8), size: rand(1.2, 2.8), color: pick(CMYK),
        }));
      }
    }

    // Paper in flight: speed lines streaming off the sheet; a sheet still in the slot rattles dust out.
    for (const paper of s.papers) {
      const x = this.laneX(paper.lane);
      if (t < paper.launchAt) {
        for (let i = this.count(`slot${paper.id}`, 14, dt); i > 0; i--) {
          this.add(particle('glint', x + rand(-0.1, 0.1) * w, rand(6, 16), {
            vy: rand(10, 40), life: rand(0.2, 0.4), size: rand(1.5, 3), color: '#f5a524',
          }));
        }
        continue;
      }
      const f = Math.min(1, (t - paper.launchAt) / Math.max(1, paper.impactAt - paper.launchAt));
      const top = 6 + f * (h - 6 - 92);
      for (let i = this.count(`trail${paper.id}`, 70, dt); i > 0; i--) {
        this.add(particle('streak', x + rand(-0.13, 0.13) * w, top + rand(-4, 6), {
          vy: rand(-30, -5), life: rand(0.12, 0.24), size: rand(12, 26), color: '#fbfbf8', alpha: 0.5,
        }));
      }
    }

    // Charge: electric crackle off the progress bar's leading edge and the printer's slots.
    if (s.charge) {
      const k = Math.min(1, (t - s.charge.from) / Math.max(1, s.charge.until - s.charge.from));
      for (let i = this.count('crackle', 10 + 40 * k, dt); i > 0; i--) {
        const a = rand(-Math.PI, 0);
        const v = rand(60, 200);
        this.add(particle('spark', this.laneX(Math.floor(Math.random() * LANE_COUNT)) + rand(-0.15, 0.15) * w, 8, {
          vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v, life: rand(0.15, 0.35), size: rand(1, 2), color: '#6fb4ff',
          drag: 0.05,
        }));
      }
    }

    // Channelling a reset: motes spiral into the player.
    if (s.channelFrom !== null) {
      const cx = this.laneX(s.lane);
      const cy = this.playerY;
      for (let i = this.count('channel', 45, dt); i > 0; i--) {
        const a = rand(0, Math.PI * 2);
        const r = rand(48, 72);
        const life = rand(0.3, 0.45);
        this.add(particle('glint', cx + Math.cos(a) * r, cy + Math.sin(a) * r, {
          vx: (-Math.cos(a) * r) / life + Math.sin(a) * 60, vy: (-Math.sin(a) * r) / life - Math.cos(a) * 60,
          life, size: rand(1.5, 3), color: '#9fd0ff',
        }));
      }
    }

    // Exposed weak point: it glints so the eye goes there.
    if (s.exposure && t >= s.exposure.from) {
      const x = this.laneX(s.exposure.lane);
      const color = s.exposure.stun ? '#9fd0ff' : '#7dffb0';
      for (let i = this.count('weak', s.exposure.stun ? 26 : 14, dt); i > 0; i--) {
        this.add(particle('glint', x + rand(-0.14, 0.14) * w, WEAK_Y + rand(-14, 26), {
          vy: rand(-30, -8), life: rand(0.3, 0.6), size: rand(2, 4), color,
        }));
      }
      if (s.exposure.stun) {
        for (let i = this.count('arc', 22, dt); i > 0; i--) {
          const a = rand(0, Math.PI * 2);
          const v = rand(80, 220);
          this.add(particle('spark', x + rand(-0.12, 0.12) * w, WEAK_Y + rand(-10, 20), {
            vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.1, 0.22), size: 1.5, color: '#cfe6ff', drag: 0.02,
          }));
        }
      }
    }
  }

  /** Bounces toner off the block shield, throwing a blue spark now and then. */
  private deflect(p: Particle, c: { x: number; y: number }): void {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const r = SHIELD_R + (p.kind === 'smoke' ? p.size * 0.35 : 0);
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r || dy > 8) return;
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d;
    const ny = dy / d;
    p.x = c.x + nx * r;
    p.y = c.y + ny * r;
    const dot = p.vx * nx + p.vy * ny;
    if (dot < 0) {
      const bounce = p.kind === 'drop' ? 1.5 : 1.05;
      p.vx = (p.vx - bounce * dot * nx) * 0.7;
      p.vy = (p.vy - bounce * dot * ny) * 0.55;
      if (p.kind === 'drop' && Math.random() < 0.18 && this.particles.length < MAX_PARTICLES) {
        this.particles.push(particle('spark', p.x, p.y, {
          vx: nx * rand(80, 200) + rand(-40, 40), vy: ny * rand(80, 200), life: rand(0.12, 0.25), size: 1.6,
          color: '#9fd0ff', drag: 0.05,
        }));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bursts (one per event)
  // -------------------------------------------------------------------------

  private add(p: Particle): void {
    if (this.particles.length < MAX_PARTICLES) this.particles.push(p);
  }

  private sparks(x: number, y: number, n: number, colors: readonly string[], speed: [number, number], spread = Math.PI * 2, dir = 0): void {
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-spread / 2, spread / 2);
      const v = rand(speed[0], speed[1]);
      this.add(particle('spark', x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 260, drag: 0.08, life: rand(0.25, 0.55), size: rand(1.4, 2.6),
        color: pick(colors),
      }));
    }
  }

  private shreds(x: number, y: number, n: number, colors: readonly string[], up: [number, number], side = 180): void {
    for (let i = 0; i < n; i++) {
      this.add(particle('shred', x + rand(-14, 14), y + rand(-6, 6), {
        vx: rand(-side, side), vy: -rand(up[0], up[1]), gravity: 620, drag: 0.25, life: rand(0.7, 1.2), size: rand(5, 10),
        rot: rand(0, Math.PI), vr: rand(-14, 14), color: pick(colors),
      }));
    }
  }

  private ring(x: number, y: number, color: string, size: number, grow: number, life = 0.4, width = 3): void {
    this.add(particle('ring', x, y, { size, grow, life, color, alpha: width }));
  }

  private puff(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 90);
      this.add(particle('smoke', x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, drag: 0.1, life: rand(0.4, 0.7), size: rand(6, 12), grow: 40,
        color, alpha: 0.5,
      }));
    }
  }

  private text(x: number, y: number, text: string, color: string, size: number): void {
    this.add(particle('text', x, y, { text, color, size, vy: -70, drag: 0.15, life: 1.05 }));
  }

  private dash(from: number, to: number): void {
    const dir = Math.sign(to - from);
    for (let i = 0; i < 3; i++) {
      const x = this.laneX(from) + ((this.laneX(to) - this.laneX(from)) * i) / 3;
      this.add(particle('ghost', x, this.playerY, { life: 0.12 + i * 0.04, alpha: 0.1 + i * 0.07, color: '#f4eeee' }));
    }
    for (let i = 0; i < 6; i++) {
      this.add(particle('smoke', this.laneX(from) + rand(-10, 10), this.playerY + 20, {
        vx: -dir * rand(30, 110), vy: rand(-30, -5), drag: 0.1, life: rand(0.25, 0.45), size: rand(4, 8), grow: 30,
        color: '#8a8189', alpha: 0.4,
      }));
    }
  }

  private paperShred(lane: number): void {
    const x = this.laneX(lane);
    const y = this.h - IMPACT_Y;
    this.shreds(x, y, 18, ['#fbfbf8', '#e6e2da', '#d8d2c8'], [140, 340], 220);
    this.puff(x, y + 10, '#9a9196', 6);
    this.ring(x, y + 14, '#fbfbf8', 8, 140, 0.3, 2);
  }

  private paperHit(lane: number): void {
    const x = this.laneX(lane);
    const y = this.playerY;
    this.shreds(x, y - 10, 22, ['#fbfbf8', '#e6e2da', '#ffd6d6'], [160, 380], 260);
    this.sparks(x, y - 10, 14, ['#ff6b6b', '#ffffff'], [140, 320]);
    this.ring(x, y, '#ff4d4f', 14, 240, 0.35, 4);
  }

  private tonerHit(lane: number): void {
    const cx = this.laneX(lane);
    const cy = this.playerY;
    // Ink splatters on the "glass", most of them over the player.
    for (let i = 0; i < 8; i++) {
      const near = i < 4;
      const x = near ? cx + rand(-60, 60) : rand(0.08, 0.92) * this.w;
      const y = near ? cy + rand(-70, 10) : rand(0.15, 0.85) * this.h;
      this.splat(x, y, near ? rand(14, 26) : rand(8, 18), i === 0 ? pick(CMYK.slice(0, 3)) : '#0c0809');
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(40, 160);
      this.add(particle('smoke', cx, cy, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, drag: 0.08, life: rand(0.6, 1.1), size: rand(12, 20), grow: 40,
        color: pick(SMOKE), alpha: 0.7,
      }));
    }
  }

  private splat(x: number, y: number, r: number, color: string): void {
    const blobs = Array.from({ length: 9 }, () => {
      const a = rand(0, Math.PI * 2);
      const d = r * rand(0.9, 2.1);
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: rand(1.5, r * 0.32) };
    });
    blobs.push(...Array.from({ length: 4 }, () => ({ dx: rand(-r, r) * 0.5, dy: rand(-r, r) * 0.5, r: r * rand(0.55, 0.8) })));
    const drips = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      dx: rand(-r * 0.7, r * 0.7),
      w: rand(2.5, 5),
      len: rand(r * 1.2, r * 3),
    }));
    this.add(particle('splat', x, y, { size: r, life: rand(2.2, 3), color, blobs, drips, alpha: 0.92 }));
  }

  private blocked(lane: number): void {
    const x = this.laneX(lane);
    const y = this.playerY;
    this.ring(x, y, '#6fb4ff', SHIELD_R * 0.8, 260, 0.45, 4);
    this.sparks(x, y - SHIELD_R * 0.6, 22, ['#6fb4ff', '#cfe6ff'], [120, 300], Math.PI, -Math.PI / 2);
  }

  private yank(lane: number, amount: number, stun: boolean): void {
    const x = this.laneX(lane);
    const colors = stun ? ['#6fb4ff', '#cfe6ff', '#ffffff'] : ['#3ad07a', '#ffd23f', '#ffffff'];
    this.sparks(x, WEAK_Y, stun ? 46 : 30, colors, [180, 460]);
    this.shreds(x, WEAK_Y + 10, stun ? 26 : 16, ['#fbfbf8', '#e6e2da'], [60, 220], 240);
    this.ring(x, WEAK_Y, stun ? '#6fb4ff' : '#3ad07a', 10, 320, 0.4, 5);
    this.ring(x, WEAK_Y, '#ffffff', 4, 180, 0.25, 2);
    this.text(x, WEAK_Y + 46, stun ? `−${amount} 暴击！` : `−${amount}`, stun ? '#9fd0ff' : '#ffd23f', stun ? 30 : 26);
  }

  private whiff(lane: number): void {
    const x = this.laneX(lane);
    const y = this.playerY - 30;
    this.sparks(x, y, 10, ['#ff6b6b', '#ffb3b3'], [80, 200], Math.PI, -Math.PI / 2);
    this.text(x, y - 10, '夹手！', '#ff8a8a', 16);
  }

  private interrupt(): void {
    const x = this.w / 2;
    this.ring(x, 6, '#6fb4ff', 10, this.w * 1.4, 0.55, 6);
    this.ring(x, 6, '#cfe6ff', 6, this.w * 0.9, 0.4, 3);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.sparks(this.laneX(lane), 8, 16, ['#6fb4ff', '#cfe6ff', '#ffffff'], [120, 360], Math.PI, Math.PI / 2);
    }
    this.text(x, 58, '宕机！', '#9fd0ff', 24);
  }

  private heal(amount: number): void {
    const x = this.w / 2;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let i = 0; i < 8; i++) {
        this.add(particle('glint', this.laneX(lane) + rand(-0.15, 0.15) * this.w, rand(10, 40), {
          vy: rand(-50, -15), life: rand(0.5, 0.9), size: rand(2.5, 4.5), color: '#ff9a3c',
        }));
      }
    }
    this.text(x, 40, `+${amount} 回血`, '#ffb066', 22);
  }

  private stage(): void {
    const x = this.w / 2;
    const y = this.h / 2;
    this.ring(x, y, '#f5a524', 10, this.w * 1.2, 0.6, 6);
    this.ring(x, y, '#ffffff', 6, this.w * 0.7, 0.4, 2);
    for (let lane = 0; lane < LANE_COUNT; lane++) this.shreds(this.laneX(lane), 10, 10, ['#fbfbf8', '#e6e2da', '#c9c8c2'], [0, 80], 120);
  }

  private won(): void {
    const x = this.w / 2;
    // Clear older call-outs so the victory title stands alone (the finishing blow's number stays).
    for (const p of this.particles) if (p.kind === 'text' && p.age > 0) p.life = Math.min(p.life, p.age + 0.12);
    for (let i = 0; i < 90; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = rand(220, 560);
      this.add(particle('shred', x + rand(-30, 30), this.h * 0.55, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity: 520, drag: 0.3, life: rand(1.2, 2), size: rand(5, 9),
        rot: rand(0, Math.PI), vr: rand(-16, 16), color: pick(CONFETTI),
      }));
    }
    this.sparks(x, this.h * 0.5, 40, ['#ffd23f', '#ffffff', '#3ad07a'], [160, 480]);
    this.ring(x, this.h * 0.5, '#ffd23f', 10, this.w, 0.6, 6);
  }

  /** One billow of the spray, blown out of a slot and down through the arena. */
  private tonerPuff(speed = 1): void {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const x0 = this.laneX(lane);
    const x = x0 + rand(-0.14, 0.14) * this.w;
    this.add(particle('smoke', x, rand(-6, 14), {
      vx: (x - x0) * rand(1.5, 3) + rand(-40, 40),
      vy: rand(230, 420) * speed,
      life: rand(1.05, 1.5),
      size: rand(20, 30),
      grow: rand(34, 54),
      color: pick(SMOKE),
      alpha: rand(0.5, 0.8),
      drag: 0.55,
    }));
  }

  /** The moment the spray fires: a burst out of every slot. */
  private tonerBlast(): void {
    for (let i = 0; i < 36 * this.quality; i++) this.tonerPuff(1.35);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.sparks(this.laneX(lane), 10, 10, CMYK, [200, 520], Math.PI * 0.8, Math.PI / 2);
    }
  }

  /** The spray stops: what is left of the cloud thins out quickly. */
  private dissipate(): void {
    for (const p of this.particles) {
      if (p.kind === 'smoke') p.life = Math.min(p.life, p.age + rand(0.35, 0.8));
    }
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  /** A soft round puff in `color`, cached per colour. */
  private sprite(color: string): CanvasImageSource | null {
    let s = this.sprites.get(color);
    if (!s) {
      const size = 64;
      const c: HTMLCanvasElement | OffscreenCanvas =
        typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!g) return null;
      // A smooth, roughly Gaussian falloff, so overlapping puffs read as one cloud, not bubbles.
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [stop, a] of [[0, 1], [0.25, 0.8], [0.5, 0.42], [0.75, 0.13], [1, 0]] as const) {
        grad.addColorStop(stop, rgba(color, a));
      }
      g.globalAlpha = 1;
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      this.sprites.set(color, c);
      s = c;
    }
    return s;
  }

  private drawOne(ctx: CanvasRenderingContext2D, p: Particle): void {
    const k = p.age / p.life;
    const fadeOut = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    switch (p.kind) {
      case 'smoke': {
        const img = this.sprite(p.color);
        if (!img) return;
        ctx.globalAlpha = p.alpha * Math.min(1, p.age * 8) * (1 - k);
        const d = p.size * 2;
        ctx.drawImage(img, p.x - d / 2, p.y - d / 2, d, d);
        return;
      }
      case 'drop':
      case 'spark': {
        ctx.globalAlpha = (p.kind === 'spark' ? 1 : 0.95) * fadeOut;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        const len = p.kind === 'drop' ? 0.02 : 0.035;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * len, p.y - p.vy * len);
        ctx.stroke();
        return;
      }
      case 'streak': {
        ctx.globalAlpha = p.alpha * (1 - k);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - p.size);
        ctx.stroke();
        return;
      }
      case 'shred': {
        ctx.globalAlpha = fadeOut;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // Flip like a tumbling scrap: the visible width swings through zero.
        ctx.scale(Math.cos(p.age * 11 + p.seed), 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
        ctx.restore();
        return;
      }
      case 'ring': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, p.alpha * (1 - k));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      case 'glint': {
        ctx.globalAlpha = Math.sin(Math.PI * k);
        ctx.fillStyle = p.color;
        const r = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r * 1.8);
        ctx.lineTo(p.x + r * 0.4, p.y - r * 0.4);
        ctx.lineTo(p.x + r * 1.8, p.y);
        ctx.lineTo(p.x + r * 0.4, p.y + r * 0.4);
        ctx.lineTo(p.x, p.y + r * 1.8);
        ctx.lineTo(p.x - r * 0.4, p.y + r * 0.4);
        ctx.lineTo(p.x - r * 1.8, p.y);
        ctx.lineTo(p.x - r * 0.4, p.y - r * 0.4);
        ctx.closePath();
        ctx.fill();
        return;
      }
      case 'splat': {
        const appear = Math.min(1, p.age / 0.06);
        ctx.globalAlpha = p.alpha * fadeOut;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * appear, 0, Math.PI * 2);
        for (const b of p.blobs ?? []) {
          ctx.moveTo(p.x + b.dx * appear + b.r, p.y + b.dy * appear);
          ctx.arc(p.x + b.dx * appear, p.y + b.dy * appear, b.r, 0, Math.PI * 2);
        }
        ctx.fill();
        // Drips run down the glass.
        for (const d of p.drips ?? []) {
          const len = d.len * Math.min(1, p.age / 1.4);
          ctx.fillRect(p.x + d.dx - d.w / 2, p.y, d.w, len);
          ctx.beginPath();
          ctx.arc(p.x + d.dx, p.y + len, d.w * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        // Wet highlight.
        ctx.globalAlpha = 0.18 * fadeOut;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 'ghost': {
        // An afterimage, stretched along the dash and fading fast.
        ctx.globalAlpha = p.alpha * (1 - k) * (1 - k);
        ctx.fillStyle = p.color;
        const rw = 56 * (1 + 0.5 * k);
        const rh = 42 * (1 - 0.35 * k);
        ctx.beginPath();
        ctx.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 10);
        ctx.fill();
        return;
      }
      case 'text': {
        const pop = p.age < 0.12 ? 0.5 + (p.age / 0.12) * 0.75 : p.age < 0.22 ? 1.25 - ((p.age - 0.12) / 0.1) * 0.25 : 1;
        const label = p.text ?? '';
        ctx.globalAlpha = fadeOut;
        ctx.font = `800 ${Math.round(p.size * pop)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        // Keep the whole label inside the arena (edge lanes are narrow on phones).
        const half = ctx.measureText(label).width / 2 + 6;
        const x = Math.min(this.w - half, Math.max(half, p.x));
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(label, x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(label, x, p.y);
        return;
      }
    }
  }
}
