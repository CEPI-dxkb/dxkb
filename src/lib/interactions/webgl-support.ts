let cached: boolean | undefined;

function probe(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the browser can create a WebGL 2 context, which Sigma 4 requires (v3 fell back to
 * WebGL 1). Probed once and cached; it reads `document`, so call it only on the client.
 */
export function supportsWebGl2(): boolean {
  cached ??= probe();
  return cached;
}
