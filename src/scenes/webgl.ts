/** Feature-detects WebGL without keeping the probe context alive. */
export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type RenderMode = '3d' | 'simple';

/** `?render=simple` starts in the simplified (no-WebGL) display. */
export function initialRenderMode(): RenderMode {
  try {
    return new URLSearchParams(window.location.search).get('render') === 'simple' ? 'simple' : '3d';
  } catch {
    return '3d';
  }
}
