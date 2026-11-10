import { Component, Suspense, useCallback, useState, type ReactNode } from 'react';
import type { SceneProps } from '../game/contracts';
import { FallbackScene } from './FallbackScene';
import { getSceneComponent } from './registry';
import { detectWebGL, initialRenderMode, type RenderMode } from './webgl';

type Failure = 'unsupported' | 'lost' | 'error' | null;

const FAILURE_NOTE: Record<Exclude<Failure, null>, string> = {
  unsupported: '当前浏览器不支持 WebGL，已使用简化显示。',
  lost: '3D 渲染中断，已切换为简化显示。',
  error: '3D 场景加载失败，已切换为简化显示。',
};

class SceneErrorBoundary extends Component<{ onError: () => void; fallback: ReactNode; children: ReactNode }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  sceneId: string;
  sceneProps: SceneProps;
  statusText: string;
}

/** Chooses between the registered 3D scene and the simplified display. Owns no game rules. */
export function SceneHost({ sceneId, sceneProps, statusText }: Props) {
  const [mode, setMode] = useState<RenderMode>(initialRenderMode);
  const [failure, setFailure] = useState<Failure>(() => (detectWebGL() ? null : 'unsupported'));
  const [attempt, setAttempt] = useState(0);
  const onContextLost = useCallback(() => setFailure('lost'), []);
  const onError = useCallback(() => setFailure('error'), []);

  const Scene = getSceneComponent(sceneId);
  const use3D = mode === '3d' && failure === null && Scene !== undefined;
  const fallback = <FallbackScene {...sceneProps} statusText={statusText} />;

  const toggle = () => {
    if (mode === '3d' && failure === null) {
      setMode('simple');
      return;
    }
    // Back to 3D: retry, re-detecting support.
    setMode('3d');
    setFailure(detectWebGL() ? null : 'unsupported');
    setAttempt((n) => n + 1);
  };
  const simpleActive = !use3D;

  return (
    <div className="scene" data-render={use3D ? '3d' : 'simple'}>
      <div className="scene__viewport">
        {use3D ? (
          <SceneErrorBoundary key={attempt} onError={onError} fallback={fallback}>
            <Suspense fallback={fallback}>
              <div className="scene__canvas" role="img" aria-label={`打印机 3D 场景：${statusText}`}>
                <Scene {...sceneProps} onContextLost={onContextLost} />
              </div>
            </Suspense>
          </SceneErrorBoundary>
        ) : (
          fallback
        )}
      </div>
      <div className="scene__bar">
        <p className="scene__note" role="status">
          {failure ? FAILURE_NOTE[failure] : ''}
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          aria-pressed={simpleActive}
          onClick={toggle}
          disabled={failure === 'unsupported'}
          title={failure ? '再次点击可重试 3D 显示' : undefined}
        >
          简化显示
        </button>
      </div>
    </div>
  );
}
