export interface WebGLProbe {
  webgl: boolean;
  /**
   * The browser renders without a GPU (SwiftShader, llvmpipe, Microsoft Basic Render Driver...).
   * Full-screen animation is expensive there; the backdrop keeps its motion small.
   */
  software: boolean;
}

let cached: WebGLProbe | null = null;

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Feature-detects WebGL without keeping the probe context alive. The first result is cached and
 * shared (the backdrop and the scene host both ask on load); `fresh` probes again (retrying 3D).
 */
export function probeWebGL(fresh = false): WebGLProbe {
  if (cached && !fresh) return cached;
  let result: WebGLProbe = { webgl: false, software: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      result = { webgl: true, software: SOFTWARE.test(renderer) };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // no WebGL: treated as software rendering
  }
  cached = result;
  return result;
}

/** Probes WebGL support afresh. */
export function detectWebGL(): boolean {
  return probeWebGL(true).webgl;
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
