import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LevelDefinition, SceneProps, SkillResult } from '../game/contracts';
import { findAction, findPhase } from '../game/engine';
import type { AttackKind } from '../game/fight';
import { getFight } from '../game/fights';
import { useGame } from '../game/useGame';
import { SceneHost } from '../scenes/SceneHost';
import { ActionPanel } from './ActionPanel';
import { BossHud } from './BossHud';
import { INTENSITY_LABEL, OUTCOME_STATUS, UI } from './copy';
import { describeLastTurn } from './feedback';
import { FightArena } from './FightArena';
import { fightSeed, initialAssist, useGameShortcuts, usePrefersReducedMotion } from './hooks';
import { PatienceMeter } from './PatienceMeter';
import { ResultPanel } from './ResultPanel';
import { SkillChallenge } from './SkillChallenge';

/** Generic level layout. Everything level-specific comes from `level`. */
export function GameShell({ level }: { level: LevelDefinition }) {
  const game = useGame(level);
  const { state, phase, actions, intensity, progress, lastTurn, act, hit, winFight, restart: restartGame } = game;
  const reducedMotion = usePrefersReducedMotion();
  const consoleRef = useRef<HTMLElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const [assist, setAssist] = useState(initialAssist);
  /** Action whose skill check is open, if any. */
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const challengeAction = challengeId ? actions.find((a) => a.id === challengeId) : undefined;
  const challenge = challengeAction?.skill ? { ...challengeAction, skill: challengeAction.skill } : null;

  /** Bumped on every restart so a fight in the initial phase starts over too. */
  const [run, setRun] = useState(0);
  const fight = phase.fight ? getFight(phase.fight.id) : undefined;
  /** Live HP of the current fight, reported by the arena (presentation only). */
  const [fightHp, setFightHp] = useState<{ key: string; health: number } | null>(null);
  const fightKey = `${run}:${state.phaseId}`;
  const isBossFight = fight !== undefined && intensity === 'critical';
  const bossHealth = !phase.fight
    ? game.bossHealth
    : !isBossFight
      ? null
      : state.outcome === 'perfect' || state.outcome === 'normal'
        ? 0
        : fightHp?.key === fightKey
          ? fightHp.health
          : 1;

  const restart = useCallback(() => {
    setChallengeId(null);
    setRun((n) => n + 1);
    restartGame();
  }, [restartGame]);

  const onFightHit = useCallback((attack: AttackKind) => hit(attack), [hit]);
  const onFightHealth = useCallback((health: number) => setFightHp({ key: fightKey, health }), [fightKey]);

  const choose = useCallback(
    (actionId: string) => {
      const action = actions.find((a) => a.id === actionId);
      if (!action) return;
      if (!action.skill) act(actionId);
      else if (assist) act(actionId, 'success');
      else setChallengeId(actionId);
    },
    [actions, act, assist],
  );

  const resolveChallenge = useCallback(
    (result: SkillResult) => {
      if (challengeId) act(challengeId, result);
      setChallengeId(null);
    },
    [act, challengeId],
  );
  const cancelChallenge = useCallback(() => setChallengeId(null), []);

  const actionIds = useMemo(() => actions.map((a) => a.id), [actions]);
  useGameShortcuts(actionIds, choose, restart, challenge === null);

  // When the focused button disappears (phase change, restart, closed check), keep focus in the console.
  useEffect(() => {
    // ResultPanel, SkillChallenge and FightArena focus their own buttons.
    if (state.outcome || challengeId || phase.fight) return;
    const active = document.activeElement;
    if (!active || active === document.body) {
      consoleRef.current?.querySelector<HTMLButtonElement>('.btn--action')?.focus();
    }
  }, [state.phaseId, state.outcome, state.turns.length, challengeId, phase.fight]);

  // The boss hits back: shake the window on every turn that cost patience.
  const turnCount = state.turns.length;
  const lastCost = lastTurn?.patienceCost ?? 0;
  useEffect(() => {
    if (turnCount === 0 || lastCost === 0 || reducedMotion) return;
    windowRef.current?.animate?.(
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(-6px, 2px)' },
        { transform: 'translate(5px, -3px)' },
        { transform: 'translate(-3px, 1px)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 320, easing: 'ease-out' },
    );
  }, [turnCount, lastCost, reducedMotion]);

  const feedback = describeLastTurn(level, state);
  const statusText = state.outcome ? OUTCOME_STATUS[state.outcome] : phase.title;
  const sceneProps: SceneProps = {
    cue: phase.cue,
    outcome: state.outcome,
    intensity,
    patience: state.patience,
    initialPatience: level.initialPatience,
    turnCount,
    lastTurnHurt: lastCost > 0,
    bossHealth,
    reducedMotion,
  };

  return (
    <div
      className="app"
      data-intensity={intensity}
      data-outcome={state.outcome ?? undefined}
      data-low-patience={state.patience === 1 || undefined}
      data-boss={bossHealth !== null || undefined}
      data-fight={(fight && !state.outcome) || undefined}
    >
      <div className="window" ref={windowRef}>
        <header className="titlebar">
          <span className="titlebar__icon" aria-hidden="true" />
          <h1 className="titlebar__title">
            <span className="titlebar__app">{UI.appName}</span>
            <span className="titlebar__sep" aria-hidden="true">
              ·
            </span>
            <span className="titlebar__level">{level.title}</span>
          </h1>
          <span className="titlebar__tag" data-intensity={intensity}>
            {state.outcome ? '已结束' : INTENSITY_LABEL[intensity]}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--small titlebar__restart"
            onClick={restart}
            aria-keyshortcuts="R"
          >
            {UI.restartShort}
          </button>
        </header>

        <div className="layout">
          <section className="device" aria-label="打印机状态">
            <BossHud title={level.title} health={bossHealth} turnCount={turnCount} lastCost={lastCost} />
            <SceneHost sceneId={level.sceneId} sceneProps={sceneProps} statusText={statusText} />
            <dl className="statusbar">
              <div className="statusbar__item statusbar__item--status">
                <dt>{UI.status}</dt>
                <dd>
                  <span className="status-dot" aria-hidden="true" />
                  {statusText}
                </dd>
              </div>
              <div className="statusbar__item">
                <dt>{UI.phase}</dt>
                <dd>
                  {progress.index} / {progress.total}
                </dd>
              </div>
              <div className="statusbar__item">
                <dt>{UI.patience}</dt>
                <dd>
                  {state.patience} / {level.initialPatience}
                </dd>
              </div>
            </dl>
          </section>

          <main className="console" ref={consoleRef}>
            <div className="panel objective">
              <p className="objective__row">
                <span className="panel__label">{UI.objective}</span>
                <span className="objective__text">{level.objective}</span>
              </p>
              <PatienceMeter patience={state.patience} max={level.initialPatience} />
            </div>

            <section className="panel phase" aria-labelledby="phase-title" key={state.phaseId}>
              <p className="phase__kicker">
                <span>
                  {UI.phase} {progress.index}/{progress.total}
                </span>
                <span className="phase__intensity">{state.outcome ? '已结束' : INTENSITY_LABEL[intensity]}</span>
              </p>
              <h2 id="phase-title" className="phase__title">
                {phase.title}
              </h2>
              <p className="phase__desc">{phase.description}</p>
            </section>

            {state.outcome ? (
              <ResultPanel
                outcome={state.outcome}
                ending={level.endings[state.outcome]}
                patienceSpent={state.patienceSpent}
                steps={state.turns.length}
                hits={
                  level.phases.some((p) => p.fight)
                    ? state.turns.filter((t) => t.fight === 'hit').length
                    : undefined
                }
                printed={level.objective}
                onRestart={restart}
              />
            ) : fight ? (
              <FightArena
                key={fightKey}
                fight={fight}
                seed={fightSeed()}
                assist={assist}
                isBoss={isBossFight}
                onHit={onFightHit}
                onWon={winFight}
                onHealth={onFightHealth}
              />
            ) : challenge ? (
              <SkillChallenge
                key={`${state.turns.length}:${challenge.id}`}
                action={challenge}
                reducedMotion={reducedMotion}
                onResolve={resolveChallenge}
                onCancel={cancelChallenge}
              />
            ) : (
              <ActionPanel actions={actions} onAct={choose} />
            )}

            <p className="feedback" data-tone={feedback?.tone ?? 'idle'} role="status" aria-live="polite">
              {feedback?.text ?? (phase.fight ? UI.feedbackIdleFight : UI.feedbackIdle)}
            </p>

            <section className="panel log" aria-labelledby="log-heading">
              <h2 id="log-heading" className="panel__label">
                {UI.log}
              </h2>
              {state.turns.length === 0 ? (
                <p className="log__empty">{UI.logEmpty}</p>
              ) : (
                <ol className="log__list">
                  {state.turns.map((turn, i) => {
                    const p = findPhase(level, turn.phaseId);
                    const a = p && findAction(p, turn.actionId);
                    const label =
                      turn.fight === 'hit'
                        ? UI.hitLog[turn.actionId as AttackKind] ?? turn.actionId
                        : turn.fight === 'won'
                          ? UI.fightWonLog(p?.title ?? turn.phaseId)
                          : a?.label ?? turn.actionId;
                    return (
                      <li
                        key={i}
                        className="log__item"
                        data-hurt={turn.patienceCost > 0 || undefined}
                        data-fight={turn.fight}
                      >
                        <span className="log__index">{String(i + 1).padStart(2, '0')}</span>
                        <span className="log__label">
                          {label}
                          {turn.skill && (
                            <span className="log__skill" data-skill-result={turn.skill}>
                              {turn.skill === 'success' ? UI.logSkillSuccess : UI.logSkillFail}
                            </span>
                          )}
                        </span>
                        <span className="log__cost">
                          {turn.patienceCost > 0 ? `耐心 −${turn.patienceCost}` : '—'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <div className="console__footer">
              <p className="hint">{phase.fight ? UI.fightKeyboardHint : UI.keyboardHint}</p>
              <button
                type="button"
                className="btn btn--ghost btn--small assist-toggle"
                aria-pressed={assist}
                onClick={() => setAssist((v) => !v)}
                title={UI.assistHint}
              >
                {UI.assist}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
