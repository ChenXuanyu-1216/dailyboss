import { useCallback, useMemo, useState } from 'react';
import { ConfigErrorView } from '../ui/ConfigErrorView';
import { GameShell } from '../ui/GameShell';
import { initialLevelId, readStoredLevel, rememberLevel } from './levelChoice';
import { DEFAULT_LEVEL_ID, LEVEL_SOURCES, listLevels, loadLevel } from './levels';

function startingLevelId(): string {
  let search = '';
  try {
    search = window.location.search;
  } catch {
    // ignore
  }
  return initialLevelId(search, readStoredLevel(), Object.keys(LEVEL_SOURCES), DEFAULT_LEVEL_ID);
}

export function App() {
  const [levelId, setLevelId] = useState(startingLevelId);
  /**
   * Bumped on every pick, so picking reopens the title screen even for the same level (the result
   * panel's "change level" button); from then on the title screen opens with focus on the picker.
   */
  const [visit, setVisit] = useState(0);
  const result = useMemo(() => loadLevel(levelId), [levelId]);
  const levels = useMemo(listLevels, []);

  const chooseLevel = useCallback((id: string) => {
    rememberLevel(id);
    setVisit((v) => v + 1);
    setLevelId(id);
  }, []);

  if (!result.ok) {
    return <ConfigErrorView errors={result.errors} source={`content/levels/${levelId}.json`} />;
  }
  return (
    <GameShell
      key={`${result.value.id}#${visit}`}
      level={result.value}
      levels={levels}
      onChooseLevel={chooseLevel}
      levelSwitched={visit > 0}
    />
  );
}
