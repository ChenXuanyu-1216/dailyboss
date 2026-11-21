import { Component, type ReactNode } from 'react';

/** Shows `fallback` (and reports once) if a 3D scene throws while loading or rendering. */
export class SceneErrorBoundary extends Component<{ onError: () => void; fallback: ReactNode; children: ReactNode }> {
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
