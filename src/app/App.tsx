import { useMemo } from 'react';
import { ConfigErrorView } from '../ui/ConfigErrorView';
import { GameShell } from '../ui/GameShell';
import { DEFAULT_LEVEL_ID, loadLevel } from './levels';

function requestedLevelId(): string {
  try {
    return new URLSearchParams(window.location.search).get('level') ?? DEFAULT_LEVEL_ID;
  } catch {
    return DEFAULT_LEVEL_ID;
  }
}

export function App() {
  const levelId = useMemo(requestedLevelId, []);
  const result = useMemo(() => loadLevel(levelId), [levelId]);

  if (!result.ok) {
    return <ConfigErrorView errors={result.errors} source={`content/levels/${levelId}.json`} />;
  }
  return <GameShell key={result.value.id} level={result.value} />;
}
