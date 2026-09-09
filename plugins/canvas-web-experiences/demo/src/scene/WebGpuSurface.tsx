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
  uploadElementImageWebGpu,
  type ExperimentalGpuQueue,
  type HtmlCanvasMode,
  type HtmlSurfaceDiagnostics,
} from '../runtime/htmlInCanvas';
import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';

type Mat4 = Float32Array;

function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function mediaMvp(
  aspect: number,
  sourceAspect: number,
  _time: number,
  _reducedMotion: boolean,
  binding: SurfaceBinding,
  viewportWidth: number,
  viewportHeight: number,
): Mat4 {
  const f = 1 / Math.tan(42 * Math.PI / 360);
  const portrait = aspect < 0.92;
  const narrowPortraitFactor = Math.min(1, Math.max(.72, viewportWidth / 400));
  const surfaceScale = portrait ? 1.58 * narrowPortraitFactor : 1.62;
  const projection = new Float32Array([
    f / Math.max(.1, aspect), 0, 0, 0,
    0, f, 0, 0,
    0, 0, -1.002, -1,
    0, 0, -.2002, 0,
  ]);
  const baseAngle = portrait ? -2.8 : -8;
  // A stable portrait projection is essential because this matrix also owns
  // native DOM hit testing; shader distortion continues independently.
  // Shader pixels keep moving, while the editable caption hit target stays at
  // a stable projection. Continuous DOM transforms would recursively request
  // new element snapshots.
  const angle = baseAngle;
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  const anchorNdcX = Math.max(-.68, Math.min(.68, binding.anchor.x / Math.max(1, viewportWidth) * 2 - 1));
  const anchorNdcY = Math.max(-.68, Math.min(.68, 1 - binding.anchor.y / Math.max(1, viewportHeight) * 2));
  const placementNdcX = Math.max(-.68, Math.min(.68, (binding.placement.x + binding.placement.width / 2) / Math.max(1, viewportWidth) * 2 - 1));
  const placementNdcY = Math.max(-.68, Math.min(.68, 1 - (binding.placement.y + binding.placement.height / 2) / Math.max(1, viewportHeight) * 2));
  const model = new Float32Array([
    cosine * surfaceScale, 0, -sine * surfaceScale, 0,
    0, surfaceScale / Math.max(.7, sourceAspect), 0, 0,
    sine, 0, cosine, 0,
    (portrait ? placementNdcX : anchorNdcX) * 1.72, (portrait ? placementNdcY : anchorNdcY) * 1.18, -3.35, 1,
  ]);
  return multiply(projection, model);
}

const shader = `
struct Params {
  time: f32,
  distortion: f32,
  chromatic: f32,
  pad: f32,
  mvp: mat4x4f,
};
@group(0) @binding(0) var surfaceSampler: sampler;
@group(0) @binding(1) var surfaceTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: Params;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 6>(
    vec2f(-.5, -.5), vec2f(.5, -.5), vec2f(-.5, .5),
    vec2f(-.5, .5), vec2f(.5, -.5), vec2f(.5, .5)
  );
  var uvs = array<vec2f, 6>(
    vec2f(0., 1.), vec2f(1., 1.), vec2f(0., 0.),
    vec2f(0., 0.), vec2f(1., 1.), vec2f(1., 0.)
  );
  var output: VertexOut;
  output.position = params.mvp * vec4f(positions[index], 0., 1.);
  output.uv = uvs[index];
  return output;
}

@fragment fn fragmentMain(input: VertexOut) -> @location(0) vec4f {
  let wave = sin(input.uv.y * 19. + params.time * 1.6) * params.distortion * .018;
  let uv = vec2f(clamp(input.uv.x + wave, 0., 1.), input.uv.y);
  let base = textureSample(surfaceTexture, surfaceSampler, uv);
  let split = params.chromatic * .012;
  let red = textureSample(surfaceTexture, surfaceSampler, vec2f(clamp(uv.x + split, 0., 1.), uv.y)).r;
  let blue = textureSample(surfaceTexture, surfaceSampler, vec2f(clamp(uv.x - split, 0., 1.), uv.y)).b;
  return vec4f(red, base.g, blue, max(base.a, .08));
}`;

type WebGpuSurfaceProps = {
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

export function WebGpuSurface({
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
}: WebGpuSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const requestRef = useRef<(() => void) | null>(null);
  const diagnosticsRef = useRef(diagnostics);
  const stateRef = useRef(state);
  const bindingRef = useRef(binding);
  diagnosticsRef.current = diagnostics;
  stateRef.current = state;
  bindingRef.current = binding;
  const native = mode === 'native-webgpu';
  const interactive = native && binding.visible && !binding.occluded;

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !interactive) return;
    configureLayoutSubtree(canvas);
    let disposed = false;
    let frame = 0;
    let lifecycle: ReturnType<typeof installPaintLifecycle> | null = null;
    let device: any = null;
    let context: any = null;
    let surfaceTexture: any = null;
    let bindGroup: any = null;
    let uniformBuffer: any = null;
    let currentWidth = 0;
    let currentHeight = 0;
    let renderFailureReported = false;
    let retired = false;
    let lastRenderAt = 0;
    let lastTransformGeometry = '';
    const mvpRef: { current: Mat4 } = { current: new Float32Array(16) };

    const updateDiagnostics = (patch: Partial<HtmlSurfaceDiagnostics>) => {
      const next = { ...diagnosticsRef.current, ...patch };
      diagnosticsRef.current = next;
      onDiagnostics(next);
    };

    const retireRuntime = () => {
      if (retired) return;
      retired = true;
      cancelAnimationFrame(frame);
      lifecycle?.dispose();
      lifecycle = null;
      requestRef.current = null;
      surfaceTexture?.destroy?.();
      surfaceTexture = null;
      uniformBuffer?.destroy?.();
      uniformBuffer = null;
      context?.unconfigure?.();
    };

    const start = async () => {
      try {
        const gpu = (navigator as Navigator & { gpu?: any }).gpu;
        const adapter = await gpu?.requestAdapter?.();
        if (disposed) return;
        const acquiredDevice = await adapter?.requestDevice?.();
        if (disposed) {
          acquiredDevice?.destroy?.();
          return;
        }
        device = acquiredDevice;
        context = canvas.getContext('webgpu') as any;
        if (!device || !context || typeof device.queue?.copyElementImageToTexture !== 'function') {
          throw new DOMException('WebGPU HTML texture contract is unavailable.', 'NotSupportedError');
        }
        const preferredFormat = gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm';
        context.configure({ device, format: preferredFormat, alphaMode: 'premultiplied' });
        const module = device.createShaderModule({ code: shader });
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module, entryPoint: 'vertexMain' },
          fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: preferredFormat }] },
          primitive: { topology: 'triangle-list', cullMode: 'none' },
        });
        const textureUsage = (globalThis as any).GPUTextureUsage;
        const bufferUsage = (globalThis as any).GPUBufferUsage;
        const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        uniformBuffer = device.createBuffer({
          size: 80,
          usage: (bufferUsage?.UNIFORM ?? 0x40) | (bufferUsage?.COPY_DST ?? 0x08),
        });

        const rebuildSurfaceTexture = () => {
          const source = sourceRef.current;
          if (!source) return;
          const dpr = window.devicePixelRatio || 1;
          const width = Math.max(1, Math.round(source.offsetWidth * dpr));
          const height = Math.max(1, Math.round(source.offsetHeight * dpr));
          if (surfaceTexture && width === currentWidth && height === currentHeight) return;
          surfaceTexture?.destroy?.();
          currentWidth = width;
          currentHeight = height;
          surfaceTexture = device.createTexture({
            size: [width, height, 1],
            format: 'rgba8unorm',
            usage:
              (textureUsage?.TEXTURE_BINDING ?? 0x04) |
              (textureUsage?.COPY_DST ?? 0x02) |
              (textureUsage?.RENDER_ATTACHMENT ?? 0x10),
          });
          bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: sampler },
              { binding: 1, resource: surfaceTexture.createView() },
              { binding: 2, resource: { buffer: uniformBuffer } },
            ],
          });
        };

        const initialRect = canvas.getBoundingClientRect();
        const initialDpr = Math.min(window.devicePixelRatio || 1, initialRect.width < 620 ? 1.5 : 2);
        canvas.width = Math.max(1, Math.round(initialRect.width * initialDpr));
        canvas.height = Math.max(1, Math.round(initialRect.height * initialDpr));
        context.configure({ device, format: preferredFormat, alphaMode: 'premultiplied' });
        const initialSourceAspect = (sourceRef.current?.offsetWidth ?? 340) / Math.max(1, sourceRef.current?.offsetHeight ?? 256);
        mvpRef.current = mediaMvp(
          canvas.width / Math.max(1, canvas.height),
          initialSourceAspect,
          0,
          true,
          bindingRef.current,
          initialRect.width,
          initialRect.height,
        );

        lifecycle = installPaintLifecycle(canvas, (event) => {
          const source = sourceRef.current;
          if (!source) return;
          const started = performance.now();
          try {
            rebuildSurfaceTexture();
            uploadElementImageWebGpu(
              canvas,
              device.queue as ExperimentalGpuQueue,
              source,
              surfaceTexture,
              currentWidth,
              currentHeight,
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
                ? 'Current-frame DOM snapshot copied to the scene-bound WebGPU texture; shader pixels and DOM hit target align.'
                : `WebGPU surface and DOM hit target drifted by ${alignment.maxErrorPx.toFixed(2)} px; semantic fallback is active.`,
              primitive: 'GPUQueue.copyElementImageToTexture(current IDL)',
              apiSignature: 'copyElementImageToTexture(sourceMap, destinationMap)',
              lastCallReceipt: callReceipt('GPUQueue.copyElementImageToTexture', 'sourceMap, destinationMap', 'void'),
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
              reason: 'WebGPU copy failed; the semantic DOM fallback remains available.',
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
        }, () => updateDiagnostics({ requestPaintCount: diagnosticsRef.current.requestPaintCount + 1 }), source);
        requestRef.current = () => {
          if (retired) return;
          try {
            const requestStrategy = lifecycle?.request();
            if (requestStrategy && diagnosticsRef.current.requestStrategy !== requestStrategy) updateDiagnostics({ requestStrategy });
          } catch (error) {
            updateDiagnostics({
              ready: false,
              failure: classifyHtmlCanvasError(error),
              reason: 'WebGPU paint scheduling failed; the semantic DOM fallback is active.',
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
        };
        requestRef.current();

        device.lost?.then((info: { message?: string }) => {
          if (!disposed) updateDiagnostics({
            ready: false,
            failure: 'context-or-device-lost',
            reason: 'WebGPU device was lost. Switch to the equivalent DOM task surface.',
            lastError: info?.message || 'device lost',
          });
          if (!disposed) retireRuntime();
        });

        const render = (now: number) => {
          if (disposed || retired) return;
          if (now - lastRenderAt < 33) {
            frame = requestAnimationFrame(render);
            return;
          }
          lastRenderAt = now;
          try {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 620 ? 1.5 : 2);
            const width = Math.max(1, Math.round(rect.width * dpr));
            const height = Math.max(1, Math.round(rect.height * dpr));
            const sourceAspect = (sourceRef.current?.offsetWidth ?? 340) / Math.max(1, sourceRef.current?.offsetHeight ?? 256);
            const currentState = stateRef.current;
            const sourceFocused = sourceRef.current?.contains(document.activeElement) ?? false;
            const motionPaused = reducedMotion || sourceFocused || currentState.playing === false;
            // Publish the current projection before requesting a snapshot: the paint callback
            // uses mvpRef to align the still-interactive DOM source with the new texture extent.
            const mvp = mediaMvp(
              width / Math.max(1, height),
              sourceAspect,
              now,
              motionPaused,
              bindingRef.current,
              rect.width,
              rect.height,
            );
            mvpRef.current = mvp;
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width; canvas.height = height;
              context.configure({ device, format: preferredFormat, alphaMode: 'premultiplied' });
              requestRef.current?.();
            }
            const params = new Float32Array(20);
            params[0] = motionPaused ? 1.4 : now / 1000;
            params[1] = Math.max(0, Math.min(1, Number(currentState.distortion ?? 42) / 100));
            params[2] = Math.max(0, Math.min(1, Number(currentState.chromatic ?? 8) / 30));
            params.set(mvp, 4);
            device.queue.writeBuffer(uniformBuffer, 0, params);
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
              colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: 'clear', storeOp: 'store',
              }],
            });
            if (bindGroup) {
              pass.setPipeline(pipeline);
              pass.setBindGroup(0, bindGroup);
              pass.draw(6);
            }
            pass.end();
            device.queue.submit([encoder.finish()]);
            if (renderFailureReported && bindGroup) {
              renderFailureReported = false;
              updateDiagnostics({
                ready: true,
                failure: 'none',
                reason: 'WebGPU rendering recovered and the current DOM snapshot is visible again.',
                lastError: null,
              });
            }
          } catch (error) {
            if (!renderFailureReported) {
              renderFailureReported = true;
              updateDiagnostics({
                ready: false,
                failure: classifyHtmlCanvasError(error),
                reason: 'WebGPU rendering failed; the semantic DOM fallback is active while recovery is retried.',
                lastError: error instanceof Error ? error.message : String(error),
              });
            }
          }
          if (!disposed && !retired) frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);
      } catch (error) {
        if (disposed) return;
        updateDiagnostics({
          ready: false,
          failure: classifyHtmlCanvasError(error),
          reason: 'WebGPU initialization failed; the DOM fallback remains the authoritative task surface.',
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    };
    void start();

    return () => {
      disposed = true;
      retireRuntime();
      device?.destroy?.();
    };
  }, [interactive, onDiagnostics, reducedMotion]);

  useEffect(() => {
    if (interactive) {
      requestRef.current?.();
    }
  }, [binding.anchor.x, binding.anchor.y, diagnostics.scopeId, interactive, requestPaintToken, state]);

  return (
    <canvas
      ref={canvasRef}
      className={`experimental-webgpu-surface ${native ? 'native-active' : 'fallback-active'}`}
      aria-label={native ? `${demo.shortTitle} WebGPU HTML 텍스처 장면` : `${demo.shortTitle} WebGPU 대체 장면`}
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
