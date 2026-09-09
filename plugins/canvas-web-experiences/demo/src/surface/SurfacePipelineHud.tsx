import { formatQuantity } from '../runtime/format';
import { HTML_CANVAS_PROPOSAL_SNAPSHOT, type HtmlCanvasCapabilities, type HtmlSurfaceDiagnostics } from '../runtime/htmlInCanvas';
import type { DomainSurfaceDefinition } from '../runtime/surfaceCatalog';

type SurfacePipelineHudProps = {
  capabilities: HtmlCanvasCapabilities;
  diagnostics: HtmlSurfaceDiagnostics;
  definition: DomainSurfaceDefinition;
  onRequestPaint: () => void;
  open: boolean;
  onClose: () => void;
};

function StateDot({ supported, label }: { supported: boolean | 'unknown'; label: string }) {
  const state = supported === true ? 'supported' : supported === 'unknown' ? 'unknown' : 'unsupported';
  const detail = state === 'supported' ? 'IDL 감지됨' : state === 'unknown' ? '실행 확인 중' : 'IDL 미감지';
  return <span className={`capability-pill ${state}`} title={`${label}: ${detail}. 이 표시는 실행 성공 판정이 아닙니다.`}>{label} IDL<i aria-hidden="true" /></span>;
}

export function SurfacePipelineHud({ capabilities, diagnostics, definition, onRequestPaint, open, onClose }: SurfacePipelineHudProps) {
  if (!open) return null;
  const executionOutcome = diagnostics.mode === 'dom-overlay'
    ? 'DOM 폴백 실행 · 네이티브 호출 없음'
    : diagnostics.mode === 'disabled'
      ? '렌더 경로 비활성'
      : diagnostics.ready
        ? '실제 API 호출 · paint/정렬 PASS'
        : `네이티브 실행 실패 · ${diagnostics.failure}`;
  return (
    <section className="experiment-receipt" data-testid="experiment-receipt" aria-label="HTML-in-Canvas 실행 증거">
      <header>
        <div><span>COMMAND → EVIDENCE → CLAIM</span><strong>실행 증거</strong></div>
        <span className={`pipeline-mode ${diagnostics.mode}`} title="현재 선택된 렌더 경로">경로 · {diagnostics.mode}</span>
        <button type="button" aria-label="실행 증거 닫기" onClick={onClose}>×</button>
      </header>
      <ol className="pipeline-steps" aria-label="표면 합성 단계">
        <li className="complete">DOM</li><li className="complete">LAYOUT</li><li className={diagnostics.paintCount > 0 ? 'complete' : ''}>PAINT</li><li className={diagnostics.uploadCount > 0 ? 'complete' : ''}>UPLOAD</li><li className={diagnostics.transformSyncCount > 0 ? 'complete' : ''}>SYNC</li>
      </ol>
      <div className="capability-row" aria-label="브라우저 IDL 존재 감지. 실행 성공 판정과 별도입니다.">
        <StateDot label="2D" supported={capabilities.drawElementImage2D} />
        <StateDot label="GL" supported={capabilities.texElementImage2D} />
        <StateDot label="GPU" supported={capabilities.copyElementImageToTexture === 'unknown' ? 'unknown' : capabilities.copyElementImageToTexture === 'supported'} />
        <StateDot label="WORKER" supported={capabilities.captureElementImage && capabilities.offscreenCanvas} />
      </div>
      <p className={`pipeline-outcome ${diagnostics.ready ? 'pass' : 'hold'}`}><span>이번 경로 실행 결과</span><strong>{executionOutcome}</strong></p>
      <p className="pipeline-primitive"><span>선택 API</span><code>{definition.primitive}</code></p>
      <dl>
        <div><dt>paint</dt><dd>{formatQuantity(diagnostics.paintCount)}</dd></div>
        <div><dt>upload</dt><dd>{formatQuantity(diagnostics.uploadCount)}</dd></div>
        <div><dt>transform</dt><dd>{formatQuantity(diagnostics.transformSyncCount)}</dd></div>
        <div><dt>transform provenance</dt><dd>{diagnostics.transformSyncProvenance}</dd></div>
        <div><dt>paint request</dt><dd>{diagnostics.requestPaintCapability} · {diagnostics.requestStrategy}</dd></div>
        <div><dt>scene composite</dt><dd>{diagnostics.compositePlanId ?? 'not applicable'} · {formatQuantity(diagnostics.compositeOperationCount)} ops · {diagnostics.compositionStatus}</dd></div>
        <div><dt>composition revision</dt><dd>{diagnostics.compositionRevision ?? 'unmeasured'}</dd></div>
        <div><dt>snapshot</dt><dd>{diagnostics.snapshotPhase} · #{formatQuantity(diagnostics.paintSequence)}</dd></div>
        <div><dt>changed</dt><dd>{diagnostics.lastChangedElementIds.length ? diagnostics.lastChangedElementIds.join(', ') : 'none / manual request'}</dd></div>
        <div><dt>alignment</dt><dd>{diagnostics.alignmentErrorPx == null ? 'not measured' : `${diagnostics.alignmentErrorPx.toFixed(2)} / ${diagnostics.alignmentTolerancePx.toFixed(0)} px · ${diagnostics.alignmentStatus}`}</dd></div>
        <div><dt>ElementImage</dt><dd>{formatQuantity(diagnostics.elementImagesCaptured)} captured · {formatQuantity(diagnostics.elementImagesClosed)} closed · {formatQuantity(diagnostics.elementImagesTerminalReleased)} terminal release · {formatQuantity(diagnostics.elementImagesOutstanding)} outstanding</dd></div>
      </dl>
      <p className="pipeline-signature"><span>Pinned proposal IDL</span><code>{diagnostics.apiSignature}</code></p>
      <p className="pipeline-snapshot"><span>WICG snapshot</span><code>{HTML_CANVAS_PROPOSAL_SNAPSHOT.commit.slice(0, 8)} · {HTML_CANVAS_PROPOSAL_SNAPSHOT.commitDate}</code><small>확인 {HTML_CANVAS_PROPOSAL_SNAPSHOT.checkedAt} · transform/hit-test/requestPaint/resize는 공개 이슈로 변동 중</small></p>
      <p className="pipeline-reason">{diagnostics.reason}</p>
      {diagnostics.lastError && <p className="pipeline-error" role="status">{diagnostics.failure}: {diagnostics.lastError}</p>}
      <button type="button" disabled={!diagnostics.mode.startsWith('native-')} onClick={onRequestPaint}>{diagnostics.requestPaintCapability === 'supported' ? '현재 프레임 Paint 요청' : 'DOM invalidation으로 재검증'}</button>
    </section>
  );
}
