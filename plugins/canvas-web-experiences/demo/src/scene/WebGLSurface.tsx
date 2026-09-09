import { useEffect, useRef } from 'react';
import { SemanticDomainSurface } from '../surface/SemanticDomainSurface';
import {
  calculateScreenSpaceTransform,
  callReceipt,
  classifyHtmlCanvasError,
  configureLayoutSubtree,
  currentPaintReceipt,
  installPaintLifecycle,
  measureGpuAlignment,
  uploadElementImageWebGL,
  type ExperimentalWebGL2Context,
  type HtmlCanvasMode,
  type HtmlSurfaceDiagnostics,
} from '../runtime/htmlInCanvas';
import { DOMAIN_SURFACES } from '../runtime/surfaceCatalog';
import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';
import { createProductMesh, createSpatialMesh } from './productMesh';

const bodyVertexSource = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uMvp;
uniform mat4 uRotation;
out vec3 vNormal;
out vec3 vPosition;
void main(){ gl_Position=uMvp*vec4(aPosition,1.0); vNormal=mat3(uRotation)*aNormal; vPosition=(uRotation*vec4(aPosition,1.0)).xyz; }`;
const bodyFragmentSource = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vPosition;
uniform vec3 uColor;
uniform float uLight;
uniform float uMetal;
out vec4 outColor;
void main(){
 vec3 n=normalize(vNormal); vec3 l=normalize(vec3(-.7,1.2,1.6));
 float diffuse=max(dot(n,l),0.0); float rim=pow(1.0-abs(n.z),3.0);
 float spec=pow(max(dot(reflect(-l,n),vec3(0,0,1)),0.0),mix(24.0,96.0,uMetal));
 vec3 color=uColor*(.17+diffuse*.85*uLight)+vec3(1.0,.85,.65)*spec*.9+vec3(.25,.6,.8)*rim*.5;
 color+=uColor*.1*max(dot(n,normalize(vec3(1,-.5,-1))),0.0);
 outColor=vec4(pow(color,vec3(.85)),1.0);
}`;

const vertexShaderSource = `#version 300 es
in vec3 aPosition;
in vec2 aTextureCoord;
uniform mat4 uMvp;
out vec2 vTextureCoord;
void main() {
  gl_Position = uMvp * vec4(aPosition, 1.0);
  vTextureCoord = aTextureCoord;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec2 vTextureCoord;
uniform sampler2D uSurface;
uniform vec3 uTint;
out vec4 outColor;
void main() {
  vec4 surface = texture(uSurface, vTextureCoord);
  float edge = smoothstep(.09, .01, min(min(vTextureCoord.x, 1.0 - vTextureCoord.x), min(vTextureCoord.y, 1.0 - vTextureCoord.y)));
  vec3 lit = surface.rgb + uTint * edge * .24;
  outColor = vec4(lit, max(surface.a, edge * .34));
}`;

type Mat4 = Float32Array;

function identity(): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function perspective(fieldOfView: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * 2 * range, 0,
  ]);
}

function translation(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function scale(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[0] = x; out[5] = y; out[10] = z;
  return out;
}

function rotateX(radians: number): Mat4 {
  const out = identity();
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  out[5] = cosine; out[6] = sine; out[9] = -sine; out[10] = cosine;
  return out;
}

function rotateY(radians: number): Mat4 {
  const out = identity();
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  out[0] = cosine; out[2] = -sine; out[8] = sine; out[10] = cosine;
  return out;
}

function mvpForSurface(
  canvas: HTMLCanvasElement,
  source: HTMLElement | null,
  binding: SurfaceBinding,
  tiltX: number,
  tiltY: number,
  orbit: number,
): Mat4 {
  const aspect = Math.max(0.1, canvas.width / Math.max(1, canvas.height));
  const sourceAspect = Math.max(0.6, (source?.offsetWidth ?? 340) / Math.max(1, source?.offsetHeight ?? 260));
  const portrait = aspect < 0.92;
  const rect = canvas.getBoundingClientRect();
  const narrowPortraitFactor = Math.min(1, Math.max(.72, rect.width / 400));
  const surfaceScale = portrait ? 1.58 * narrowPortraitFactor : 1.55;
  const anchorNdcX = clampNdc(binding.anchor.x / Math.max(1, rect.width) * 2 - 1);
  const anchorNdcY = clampNdc(1 - binding.anchor.y / Math.max(1, rect.height) * 2);
  const placementNdcX = clampNdc((binding.placement.x + binding.placement.width / 2) / Math.max(1, rect.width) * 2 - 1);
  const placementNdcY = clampNdc(1 - (binding.placement.y + binding.placement.height / 2) / Math.max(1, rect.height) * 2);
  const horizontalOffset = (portrait ? placementNdcX : anchorNdcX) * 1.7;
  const landscapeAnchorY = binding.archetype === 'alarm-runbook'
    ? Math.max(-.44, Math.min(.38, anchorNdcY))
    : anchorNdcY;
  const verticalOffset = (portrait ? placementNdcY : landscapeAnchorY) * 1.15;
  const resolvedTiltX = portrait ? tiltX * 0.35 : tiltX;
  const resolvedTiltY = portrait ? tiltY * 0.35 : tiltY;
  // Keep the projected DOM hit target stationary on touch-first portrait views.
  // The surrounding scene still animates, while controls remain reliably tappable.
  const resolvedOrbit = portrait ? 0 : orbit;
  const projection = perspective(42 * Math.PI / 180, aspect, 0.1, 100);
  const model = multiply(
    translation(horizontalOffset, verticalOffset, -3.35),
    multiply(
      rotateY((resolvedTiltY + resolvedOrbit) * Math.PI / 180),
      multiply(rotateX(resolvedTiltX * Math.PI / 180), scale(surfaceScale, surfaceScale / sourceAspect, 1)),
    ),
  );
  return multiply(projection, model);
}

function clampNdc(value: number): number {
  return Math.max(-.72, Math.min(.72, value));
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) || 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function colorToRgb(color: string): [number, number, number] {
  const parsed = color.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(parsed.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

type WebGLSurfaceProps = {
  sceneModelRef: { current: SceneRuntimeState };
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  binding: SurfaceBinding;
  mode: HtmlCanvasMode;
  diagnostics: HtmlSurfaceDiagnostics;
  requestPaintToken: number;
  reducedMotion: boolean;
  onControlChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
  onDiagnostics: (diagnostics: HtmlSurfaceDiagnostics) => void;
};

export function WebGLSurface({
  sceneModelRef,
  demo,
  state,
  runtime,
  binding,
  mode,
  diagnostics,
  requestPaintToken,
  reducedMotion,
  onControlChange,
  onAction,
  onDiagnostics,
}: WebGLSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const paintRequestRef = useRef<(() => void) | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  const mvpRef = useRef<Mat4>(identity());
  const bindingRef = useRef(binding);
  diagnosticsRef.current = diagnostics;
  bindingRef.current = binding;
  const native = mode === 'native-webgl';
  const interactive = native && binding.visible && !binding.occluded;
  const definition = DOMAIN_SURFACES[demo.id];
  const solidObject = demo.id === 'commerce' || demo.id === 'spatial';
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || (!solidObject && (!source || !interactive))) return;
    configureLayoutSubtree(canvas);
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    }) as ExperimentalWebGL2Context | null;
    if (!gl) {
      onDiagnostics({
        ...diagnosticsRef.current,
        ready: false,
        failure: 'context-or-device-lost',
        reason: 'WebGL2 context creation failed; the semantic DOM fallback is active.',
        lastError: 'webgl2-context-unavailable',
      });
      return;
    }

    let frame = 0;
    let disposed = false;
    let lifecycle: ReturnType<typeof installPaintLifecycle> | null = null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let texture: WebGLTexture | null = null;
    let bodyProgram: WebGLProgram | null = null;
    let bodyBuffer: WebGLBuffer | null = null;
    let bodyVertex: WebGLShader | null = null;
    let bodyFragment: WebGLShader | null = null;
    let bodyCount = 0;
    let lastRenderAt = 0;
    let lastTransformGeometry = '';

    const updateDiagnostics = (patch: Partial<HtmlSurfaceDiagnostics>) => {
      const next = { ...diagnosticsRef.current, ...patch };
      diagnosticsRef.current = next;
      onDiagnostics(next);
    };

    const onContextLost = () => {
      cancelAnimationFrame(frame);
      updateDiagnostics({
        ready: false,
        failure: 'context-or-device-lost',
        reason: 'WebGL context was lost. The task-safe DOM fallback is active; re-enter Native trial to allocate a fresh context.',
        lastError: 'webglcontextlost',
      });
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    try {
      vertex = compile(gl, gl.VERTEX_SHADER, vertexShaderSource);
      fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      program = gl.createProgram();
      if (!program) throw new Error('WebGL program allocation failed.');
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'WebGL link failed.');

      const vertices = new Float32Array([
        -.5, -.5, 0, 0, 1,
         .5, -.5, 0, 1, 1,
        -.5,  .5, 0, 0, 0,
        -.5,  .5, 0, 0, 0,
         .5, -.5, 0, 1, 1,
         .5,  .5, 0, 1, 0,
      ]);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('WebGL buffer allocation failed.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'aPosition');
      const textureCoord = gl.getAttribLocation(program, 'aTextureCoord');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(textureCoord);
      gl.vertexAttribPointer(textureCoord, 2, gl.FLOAT, false, 20, 12);

      texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed.');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([18, 26, 31, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // The element-image upload already uses DOM's top-left orientation for this UV layout.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      const mvpLocation = gl.getUniformLocation(program, 'uMvp');
      const tintLocation = gl.getUniformLocation(program, 'uTint');
      const samplerLocation = gl.getUniformLocation(program, 'uSurface');
      const [red, green, blue] = colorToRgb(definition.tint);
      gl.uniform3f(tintLocation, red, green, blue);
      gl.uniform1i(samplerLocation, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (solidObject) {
        bodyVertex = compile(gl, gl.VERTEX_SHADER, bodyVertexSource);
        bodyFragment = compile(gl, gl.FRAGMENT_SHADER, bodyFragmentSource);
        bodyProgram = gl.createProgram();
        if (!bodyProgram) throw new Error('Object program allocation failed');
        gl.attachShader(bodyProgram, bodyVertex); gl.attachShader(bodyProgram, bodyFragment); gl.linkProgram(bodyProgram);
        if (!gl.getProgramParameter(bodyProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(bodyProgram) || 'Object shader link failed');
        const geometry = demo.id === 'commerce' ? createProductMesh() : createSpatialMesh();
        bodyCount = geometry.length / 6;
        bodyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuffer); gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
        canvas.dataset.meshVertices = String(bodyCount);
        canvas.dataset.geometry = 'closed-volume-triangle-mesh';
      }

      const objectMatrices = () => {
        const model = sceneModelRef.current;
        const yaw = Number(demo.id === 'commerce' ? model.productRotation ?? 0 : model.orbit ?? 0);
        const pitch = Number(demo.id === 'commerce' ? model.productPitch ?? 0 : model.orbitPitch ?? 0);
        const rotation = multiply(rotateX(pitch), rotateY(yaw));
        const fov = demo.id === 'spatial' ? Math.max(24, Math.min(75, Number(stateRef.current.perspective ?? 42))) : 42;
        const projection = perspective(fov * Math.PI / 180, canvas.width / Math.max(1, canvas.height), .1, 100);
        const aspect = canvas.width / Math.max(1, canvas.height);
        const distance = 5.5 / Math.min(1, Math.max(.52, aspect));
        const object = multiply(projection, multiply(translation(aspect < 1 ? 0 : -.35, .1, -distance), rotation));
        const sourceAspect = (sourceRef.current?.offsetWidth ?? 420) / Math.max(1, sourceRef.current?.offsetHeight ?? 322);
        const plaque = multiply(object, multiply(translation(1.3, -.1, .72), scale(2.15, 2.15/sourceAspect, 1)));
        canvas.dataset.yaw = yaw.toFixed(4); canvas.dataset.pitch = pitch.toFixed(4);
        return { object, plaque, rotation };
      };

      const initialRect = canvas.getBoundingClientRect();
      const initialDpr = Math.min(window.devicePixelRatio || 1, initialRect.width < 620 ? 1.5 : 2);
      canvas.width = Math.max(1, Math.round(initialRect.width * initialDpr));
      canvas.height = Math.max(1, Math.round(initialRect.height * initialDpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      mvpRef.current = mvpForSurface(canvas, sourceRef.current, bindingRef.current, definition.tiltX, definition.tiltY, 0);

      if (source && interactive) lifecycle = installPaintLifecycle(canvas, (event) => {
          const source = sourceRef.current;
          if (!source || !texture) return;
          const started = performance.now();
          try {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            const dpr = window.devicePixelRatio || 1;
            uploadElementImageWebGL(
              gl,
              source,
              Math.max(1, Math.round(source.offsetWidth * dpr)),
              Math.max(1, Math.round(source.offsetHeight * dpr)),
            );
            const activeBinding = bindingRef.current;
            const transformGeometry = [
              canvas.width, canvas.height, source.offsetWidth, source.offsetHeight,
              activeBinding.placement.x, activeBinding.placement.y,
              activeBinding.placement.width, activeBinding.placement.height,
              activeBinding.anchor.x, activeBinding.anchor.y, activeBinding.anchor.z,
              ...Array.from(mvpRef.current, (value) => value.toFixed(6)),
            ].join(':');
            const transformChanged = transformGeometry !== lastTransformGeometry;
            if (transformChanged) {
              calculateScreenSpaceTransform(canvas, source, mvpRef.current);
              lastTransformGeometry = transformGeometry;
            }
            const alignment = measureGpuAlignment(canvas, source, mvpRef.current);
            const paintReceipt = currentPaintReceipt(diagnosticsRef.current, event, started);
            updateDiagnostics({
              ready: alignment.status === 'pass',
              failure: alignment.status === 'pass' ? 'none' : 'alignment-drift',
              reason: alignment.status === 'pass'
                ? 'Current-frame DOM snapshot uploaded to the scene-bound WebGL mesh; projected pixels and the DOM hit target align.'
                : `WebGL mesh and DOM hit target drifted by ${alignment.maxErrorPx.toFixed(2)} px; semantic fallback is active.`,
              primitive: 'WebGL2RenderingContext.texElementImage2D(current IDL)',
              apiSignature: 'texElementImage2D(target, internalformat, element, config)',
              lastCallReceipt: callReceipt('WebGL2RenderingContext.texElementImage2D', 'target, internalformat, element, config', 'void'),
              paintCount: diagnosticsRef.current.paintCount + 1,
              uploadCount: diagnosticsRef.current.uploadCount + 1,
              transformSyncCount: diagnosticsRef.current.transformSyncCount + (transformChanged ? 1 : 0),
              ...paintReceipt,
              alignmentErrorPx: alignment.maxErrorPx,
              alignmentTolerancePx: alignment.tolerancePx,
              alignmentStatus: alignment.status,
              alignmentReceipt: alignment,
              lastPaintMs: performance.now() - started,
              lastError: null,
            });
          } catch (error) {
            updateDiagnostics({
              ready: false,
              failure: classifyHtmlCanvasError(error),
              reason: 'Native WebGL upload failed; the kill switch or DOM fallback remains available.',
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
      }, () => updateDiagnostics({ requestPaintCount: diagnosticsRef.current.requestPaintCount + 1 }), source);
      paintRequestRef.current = () => {
        try {
          const requestStrategy = lifecycle?.request();
          if (requestStrategy && diagnosticsRef.current.requestStrategy !== requestStrategy) updateDiagnostics({ requestStrategy });
        } catch (error) {
          updateDiagnostics({
            ready: false,
            failure: classifyHtmlCanvasError(error),
            reason: 'WebGL paint scheduling failed; the semantic DOM fallback is active.',
            lastError: error instanceof Error ? error.message : String(error),
          });
        }
      };
      paintRequestRef.current();

      const render = (now: number) => {
        if (disposed || !program || !buffer) return;
        if (now - lastRenderAt < 33) {
          frame = requestAnimationFrame(render);
          return;
        }
        lastRenderAt = now;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 620 ? 1.5 : 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        // Keep the semantic hit target stable. The scene beneath it can keep
        // animating, but a per-frame DOM transform would trigger a fresh HTML
        // snapshot on every frame and create a costly paint feedback loop.
        const orbit = 0;
        // Use the resized pixel extent for both the texture request and the DOM hit-test transform.
        // The requested paint can synchronously read mvpRef, so update it before requesting the paint.
        let matrices = solidObject ? objectMatrices() : null;
        const mvp = matrices?.plaque ?? mvpForSurface(canvas, sourceRef.current, bindingRef.current, definition.tiltX, definition.tiltY, orbit);
        mvpRef.current = mvp;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          matrices = solidObject ? objectMatrices() : null;
          mvpRef.current = solidObject ? objectMatrices().plaque : mvpForSurface(canvas, sourceRef.current, bindingRef.current, definition.tiltX, definition.tiltY, orbit);
          if (native) paintRequestRef.current?.();
        }
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (matrices && bodyProgram && bodyBuffer) {
          gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
          gl.useProgram(bodyProgram); gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuffer);
          const p = gl.getAttribLocation(bodyProgram, 'aPosition'), n = gl.getAttribLocation(bodyProgram, 'aNormal');
          gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 3, gl.FLOAT, false, 24, 0);
          gl.enableVertexAttribArray(n); gl.vertexAttribPointer(n, 3, gl.FLOAT, false, 24, 12);
          gl.uniformMatrix4fv(gl.getUniformLocation(bodyProgram, 'uMvp'), false, matrices.object);
          gl.uniformMatrix4fv(gl.getUniformLocation(bodyProgram, 'uRotation'), false, matrices.rotation);
          const material = String(stateRef.current.material ?? 'Glass');
          const palette: Record<string, [number, number, number]> = {Glass:[.7,.42,.18],Frosted:[.65,.8,.85],Iridescent:[.55,.3,.85],Metal:[.65,.7,.75],Ceramic:[.9,.75,.55]};
          const color = demo.id === 'spatial' ? [.23,.48,.9] : palette[material] ?? palette.Glass;
          gl.uniform3f(gl.getUniformLocation(bodyProgram, 'uColor'), color[0],color[1],color[2]);
          gl.uniform1f(gl.getUniformLocation(bodyProgram, 'uLight'), Number(stateRef.current.light ?? 100)/100);
          gl.uniform1f(gl.getUniformLocation(bodyProgram, 'uMetal'), material === 'Metal' ? 1 : .3);
          gl.drawArrays(gl.TRIANGLES, 0, bodyCount);
          gl.enable(gl.BLEND);
          if (source && interactive) {
            // CSS-to-clip conversion flips Y, so CSS backface-visibility is
            // not a valid object-facing test. Use the object's normal instead.
            source.style.backfaceVisibility = 'visible';
            source.inert = matrices.rotation[10] < .18;
            // Legacy experimental builds may drop their cached DOM snapshot
            // during HMR, resize or style invalidation. Never kill the mesh RAF.
            try {
              if (diagnosticsRef.current.paintCount > 0) calculateScreenSpaceTransform(canvas, source, mvpRef.current);
            } catch (error) {
              if (error instanceof DOMException && error.name === 'InvalidStateError') paintRequestRef.current?.();
              else if (diagnosticsRef.current.lastError !== String(error)) updateDiagnostics({ ready: false, failure: classifyHtmlCanvasError(error), lastError: String(error), reason: 'HTML geometry sync failed; the 3D object remains available with semantic DOM recovery.' });
            }
          }
        }

        const renderMvp = mvpRef.current;
        gl.useProgram(program);
        gl.uniformMatrix4fv(mvpLocation, false, renderMvp);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
        gl.enableVertexAttribArray(textureCoord); gl.vertexAttribPointer(textureCoord, 2, gl.FLOAT, false, 20, 12);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // DOM uploads can alter pixel-store state; preserve double-sided pixels
        // while geometric depth testing resolves occlusion against the sculpture.
        if (interactive && (!matrices || matrices.rotation[10] >= .18)) gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disable(gl.CULL_FACE);

        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
    } catch (error) {
      updateDiagnostics({
        ready: false,
        failure: classifyHtmlCanvasError(error),
        reason: 'WebGL initialization failed; the semantic DOM fallback remains the task surface.',
        lastError: error instanceof Error ? error.message : String(error),
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      lifecycle?.dispose();
      paintRequestRef.current = null;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (bodyBuffer) gl.deleteBuffer(bodyBuffer);
      if (bodyProgram) gl.deleteProgram(bodyProgram);
      if (bodyVertex) gl.deleteShader(bodyVertex);
      if (bodyFragment) gl.deleteShader(bodyFragment);
    };
  }, [demo.id, definition.tint, definition.tiltX, definition.tiltY, interactive, onDiagnostics, reducedMotion]);

  useEffect(() => {
    if (interactive) {
      paintRequestRef.current?.();
    }
  }, [binding.anchor.x, binding.anchor.y, diagnostics.scopeId, interactive, requestPaintToken, state]);

  return (
    <canvas
      ref={canvasRef}
      className={`experimental-webgl-surface ${native ? 'native-active' : 'fallback-active'}`}
      style={solidObject ? { opacity: 1 } : undefined}
      aria-label={native ? `${demo.shortTitle} WebGL HTML 텍스처 장면` : `${demo.shortTitle} WebGL 배경 장면`}
      {...({ layoutsubtree: '' } as Record<string, string>)}
    >
      {interactive && (
        <SemanticDomainSurface
          ref={sourceRef}
          demo={demo}
          state={state}
          runtime={runtime}
          binding={binding}
          mode={mode}
          diagnostics={diagnostics}
          variant="native-source"
          onControlChange={onControlChange}
          onAction={onAction}
        />
      )}
    </canvas>
  );
}
