import { useEffect, useRef } from 'react';
import type { FightFx } from './fightEffects';

/** Device-pixel ratio cap for the effects canvas (fill-rate matters more than crispness here). */
const MAX_DPR = 2;
/** Draw-time budget per frame; over it, the layer emits fewer particles until it fits again. */
const BUDGET_MS = 6;

/**
 * Canvas layer over the fight arena that draws `fx`. Owns its own animation loop so effects can
 * finish after the fight's clock stops (the winning blow, a pause). Decorative: aria-hidden and
 * never receives pointer input.
 */
export function FightFxLayer({ fx, paused }: { fx: FightFx; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.resize(box.width, box.height);
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);

    let raf = 0;
    let last: number | null = null;
    let drawn = true;
    /** Smoothed draw time in ms. */
    let cost = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (pausedRef.current) return;
      if (!fx.busy) {
        // Clear once after the last particle, then idle cheaply.
        if (drawn) ctx.clearRect(0, 0, fx.w, fx.h);
        drawn = false;
        return;
      }
      const t0 = performance.now();
      fx.step(dt);
      fx.draw(ctx);
      drawn = true;
      cost = cost * 0.9 + (performance.now() - t0) * 0.1;
      if (cost > BUDGET_MS) fx.quality = Math.max(0.35, fx.quality * 0.97);
      else if (cost < BUDGET_MS / 2) fx.quality = Math.min(1, fx.quality + 0.01);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [fx]);

  return <canvas ref={canvasRef} className="fight__fx" aria-hidden="true" />;
}
