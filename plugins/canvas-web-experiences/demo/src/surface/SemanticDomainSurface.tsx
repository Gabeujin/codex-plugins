import { forwardRef, memo, useEffect, useId, useImperativeHandle, useRef, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { formatQuantity } from '../runtime/format';
import type { HtmlCanvasMode, HtmlSurfaceDiagnostics } from '../runtime/htmlInCanvas';
import type { SurfaceBinding } from '../runtime/surfaceBindings';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';

type SemanticDomainSurfaceProps = {
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  binding: SurfaceBinding;
  mode: HtmlCanvasMode;
  variant: 'native-source' | 'fallback-overlay' | 'companion-overlay';
  diagnostics?: HtmlSurfaceDiagnostics;
  fallbackReason?: string;
  onControlChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
};

type SurfaceBodyProps = Omit<SemanticDomainSurfaceProps, 'variant' | 'diagnostics' | 'fallbackReason'> & {
  fieldId: (name: string) => string;
};

const stringValue = (state: DemoState, key: string, fallback: string) => String(state[key] ?? fallback);
const numberValue = (state: DemoState, key: string, fallback: number) => Number(state[key] ?? fallback);
const boolValue = (state: DemoState, key: string, fallback = false) => Boolean(state[key] ?? fallback);
const selectedIndex = (runtime: SceneRuntimeState, key: string, fallback = 0) => Math.max(0, Math.floor(runtime[key] ?? fallback));
const signalCount = (mask: number) => Math.max(0, Math.floor(mask)).toString(2).split('').filter((bit) => bit === '1').length;

function SurfaceHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <header className="surface-heading">
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      {aside}
    </header>
  );
}

function PortfolioSurface({ runtime, state, onControlChange, onAction }: SurfaceBodyProps) {
  const index = selectedIndex(runtime, 'selectedNode');
  const projects = ['Signal Commons', 'Transit Bloom', 'Civic Air', 'Material Memory'];
  const project = projects[index % projects.length];
  return (
    <>
      <SurfaceHeading eyebrow={`CASE ${String(index + 1).padStart(2, '0')} · PUBLIC INTERFACE`} title={project} aside={<span className="case-year">2026</span>} />
      <p className="surface-deck">도시 신호를 시민이 이해하고 조작할 수 있는 공공 인터페이스로 번역했습니다.</p>
      <dl className="case-facts"><div><dt>역할</dt><dd>Product · Motion</dd></div><div><dt>기간</dt><dd>18주</dd></div><div><dt>제약</dt><dd>저사양 기기 · 4개 언어</dd></div></dl>
      <div className="case-artifacts" role="group" aria-label="사례 산출물">
        <button type="button" aria-pressed={stringValue(state, 'selectedArtifact', 'Prototype') === 'Prototype'} onClick={() => onControlChange('selectedArtifact', 'Prototype')}>Prototype 04</button>
        <button type="button" aria-pressed={stringValue(state, 'selectedArtifact', 'Prototype') === 'System map'} onClick={() => onControlChange('selectedArtifact', 'System map')}>System map</button>
        <button type="button" onClick={() => onAction('openArtifact')}>산출물 열기 ↗</button>
      </div>
      {boolValue(state, 'artifactOpen') && <p className="surface-toast" role="status">Project {String(index + 1).padStart(2, '0')}에 {stringValue(state, 'selectedArtifact', 'Prototype')} HTML 조각을 합성했습니다. 연결 노드의 렌즈도 같은 snapshot을 공유합니다.</p>}
    </>
  );
}

function MotionSurface({ state, fieldId, onControlChange }: SurfaceBodyProps) {
  const noteId = fieldId('motion-intent');
  const duration = numberValue(state, 'duration', 680);
  return (
    <>
      <SurfaceHeading eyebrow="WAAPI / TOKEN 04" title="Arrival field" aside={<output>{formatQuantity(duration)} ms</output>} />
      <label className="surface-field" htmlFor={noteId}><span>움직임의 의도</span><textarea id={noteId} rows={2} value={stringValue(state, 'motionNote', '도착 직전 감속으로 상태의 확정을 설명합니다.')} onChange={(event) => onControlChange('motionNote', event.currentTarget.value)} /></label>
      <div className="token-grid" aria-label="모션 토큰">
        <label><span>curve</span><select value={stringValue(state, 'easing', 'Fluid')} onChange={(event) => onControlChange('easing', event.currentTarget.value)}>{['Fluid', 'Expressive', 'Precise', 'Elastic'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>duration</span><input type="range" min="180" max="1800" step="20" value={duration} onChange={(event) => onControlChange('duration', Number(event.currentTarget.value))} /></label>
        <label><span>scrub</span><input type="range" min="0" max="100" value={numberValue(state, 'motionScrub', 64)} onChange={(event) => onControlChange('motionScrub', Number(event.currentTarget.value))} /></label>
      </div>
      <output className="surface-toast" aria-live="polite">스크럽 {formatQuantity(numberValue(state, 'motionScrub', 64))}% · {stringValue(state, 'easing', 'Fluid')} 곡선</output>
      <button className="surface-cta" type="button" onClick={() => onControlChange('trail', !boolValue(state, 'trail', true))}>{boolValue(state, 'trail', true) ? '잔상 없이 비교' : '잔상과 비교'}</button>
    </>
  );
}

function GameSurface({ runtime, state, fieldId, onControlChange }: SurfaceBodyProps) {
  const callSignId = fieldId('callsign');
  const collected = signalCount(runtime.collected ?? 0);
  const submit = (event: FormEvent) => { event.preventDefault(); if (collected >= 6) onControlChange('gateOpen', true); };
  return (
    <form onSubmit={submit}>
      <SurfaceHeading eyebrow="root@signal / gate-06" title={boolValue(state, 'gateOpen') ? 'ACCESS GRANTED' : 'MISSION TERMINAL'} aside={<span className="terminal-caret" aria-hidden="true">▋</span>} />
      <ol className="mission-checklist">
        <li data-complete={collected >= 2}>서쪽 신호 수집 <span>{Math.min(2, collected)} / 2</span></li>
        <li data-complete={collected >= 4}>중앙 릴레이 동기화 <span>{Math.min(2, Math.max(0, collected - 2))} / 2</span></li>
        <li data-complete={collected >= 6}>게이트 키 복원 <span>{Math.min(2, Math.max(0, collected - 4))} / 2</span></li>
      </ol>
      <label className="terminal-prompt" htmlFor={callSignId}><span>호출명</span><input id={callSignId} lang="ko" autoComplete="off" value={stringValue(state, 'callSign', '캔버스-01')} onChange={(event) => onControlChange('callSign', event.currentTarget.value)} /></label>
      <button className="surface-cta" type="submit" disabled={collected < 6 && !boolValue(state, 'gateOpen')}>{boolValue(state, 'gateOpen') ? '게이트가 열렸습니다' : `인증 · 신호 ${collected} / 6`}</button>
      {boolValue(state, 'gateOpen') && <p className="surface-toast" role="status">포털 HTML aperture가 활성화되었습니다. {runtime.escaped ? '드론이 출구를 통과했습니다.' : '드론을 게이트 중심으로 이동해 탈출하세요.'}</p>}
    </form>
  );
}

function SpatialSurface({ runtime, state, onControlChange, onAction }: SurfaceBodyProps) {
  const index = selectedIndex(runtime, 'selectedArtwork', 4);
  const names = ['Afterimage', 'Soft Current', 'Weather Glass', 'Light Studies', 'Quiet Field', 'Folded Noon'];
  return (
    <>
      <SurfaceHeading eyebrow={`ARTWORK ${String(index + 1).padStart(2, '0')} / PROVENANCE`} title={names[index % names.length]} aside={<span className="approval-state">{boolValue(state, 'artworkApproved') ? 'APPROVED' : 'REVIEW'}</span>} />
      <p className="curatorial-quote">“관람자의 위치가 바뀔 때마다 빛의 소유권도 다시 배치됩니다.”</p>
      <dl className="provenance-grid"><div><dt>작가</dt><dd>Han Sol</dd></div><div><dt>매체</dt><dd>Light · glass</dd></div><div><dt>권리</dt><dd>Exhibition only</dd></div><div><dt>출처</dt><dd>Studio receipt 08</dd></div></dl>
      <div className="surface-actions"><button type="button" onClick={() => onControlChange('artworkApproved', !boolValue(state, 'artworkApproved'))}>{boolValue(state, 'artworkApproved') ? '승인 취소' : '전시 승인'}</button><button type="button" onClick={() => onAction('openProvenance')}>원본 이력 ↗</button></div>
      <div className="surface-actions"><button type="button" aria-pressed={boolValue(state, 'artworkPinned')} onClick={() => onControlChange('artworkPinned', !boolValue(state, 'artworkPinned'))}>{boolValue(state, 'artworkPinned') ? '공간 고정 해제' : '공간에 고정'}</button><button type="button" aria-expanded={boolValue(state, 'artworkExpanded')} onClick={() => onControlChange('artworkExpanded', !boolValue(state, 'artworkExpanded'))}>{boolValue(state, 'artworkExpanded') ? '요약 보기' : '큐레이션 확장'}</button></div>
      {boolValue(state, 'artworkExpanded') && <p className="surface-toast">선택 작품의 권리·출처·배치 근거를 원근 mesh에서 함께 검토합니다.</p>}
      {boolValue(state, 'provenanceOpen') && <p className="surface-toast" role="status">Studio receipt 08 · 원본 이력 검증 완료</p>}
    </>
  );
}

function MapSurface({ state, fieldId, onControlChange }: SurfaceBodyProps) {
  const queryId = fieldId('place-query');
  const zoom = numberValue(state, 'zoom', 100);
  const query = stringValue(state, 'placeQuery', '성수');
  const severity = stringValue(state, 'incidentSeverity', 'delay');
  const language = stringValue(state, 'routeLanguage', 'ko');
  const severityLabel = severity === 'closure' ? '통제' : severity === 'evacuation' ? '대피' : '지연';
  return (
    <>
      <SurfaceHeading eyebrow={`ROUTE 02 · ${severity.toUpperCase()}`} title={`${query || '선택 위치'} 이동 창`} aside={<span className="incident-severity">{severityLabel} · 12분</span>} />
      <label className="map-search" htmlFor={queryId}><span className="sr-only">장소 검색</span><input id={queryId} type="search" value={query} onChange={(event) => { onControlChange('placeQuery', event.currentTarget.value); onControlChange('mapPinned', false); }} /><button type="button" onClick={() => onControlChange('mapPinned', true)}>위치 고정</button></label>
      <div className="route-steps" aria-label="우회 경로"><span>성수역</span><i /><span>서울숲</span><i /><span>한강 교차점</span></div>
      <div className="map-context-controls"><label>사고 단계<select aria-label="사고 단계" value={severity} onChange={(event) => onControlChange('incidentSeverity', event.currentTarget.value)}><option value="delay">지연</option><option value="closure">통제</option><option value="evacuation">대피</option></select></label><label>안내 언어<select aria-label="안내 언어" value={language} onChange={(event) => onControlChange('routeLanguage', event.currentTarget.value)}><option value="ko">한국어</option><option value="ar">العربية</option></select></label></div>
      {language === 'ko' ? <p className="incident-copy">{severity === 'evacuation' ? '즉시 북쪽 보행축으로 이동하세요. 현장 안내원의 지시를 따르세요.' : severity === 'closure' ? '2번 출구가 통제되었습니다. 북쪽 우회로를 이용하세요.' : '보행 밀집으로 12분 지연됩니다. 북쪽 보행축으로 우회하세요.'}</p> : <p dir="rtl" lang="ar" className="incident-rtl">{severity === 'evacuation' ? 'استخدم مسار الإخلاء الشمالي فورًا واتبع تعليمات الموقع' : severity === 'closure' ? 'المخرج الثاني مغلق، استخدم المسار الشمالي البديل' : 'تأخير لمدة 12 دقيقة، يتوفر مسار بديل عبر الممر الشمالي'}</p>}
      <div className="map-zoom-controls" role="group" aria-label="지도 확대와 축소"><button type="button" onClick={() => onControlChange('zoom', Math.max(50, zoom - 10))} aria-label="지도 축소">−</button><output aria-live="polite">{formatQuantity(zoom)}%</output><button type="button" onClick={() => onControlChange('zoom', Math.min(240, zoom + 10))} aria-label="지도 확대">+</button><button className="surface-cta" type="button" aria-pressed={boolValue(state, 'mapPinned')} onClick={() => onControlChange('mapPinned', !boolValue(state, 'mapPinned'))}>{boolValue(state, 'mapPinned') ? '좌표 고정 해제' : '이 좌표에 고정'}</button></div>
    </>
  );
}

function DiagramSurface({ runtime, state, fieldId, onControlChange, onAction }: SurfaceBodyProps) {
  const nameId = fieldId('node-name');
  const schemaId = fieldId('schema-draft');
  const index = selectedIndex(runtime, 'selectedNode', 4);
  const valid = boolValue(state, 'nodeHealthy', true) && stringValue(state, 'schemaDraft', 'PaintReceipt → SurfaceState').includes('→');
  return (
    <>
      <SurfaceHeading eyebrow={`NODE ${String(index + 1).padStart(2, '0')} · CONTRACT`} title={stringValue(state, 'nodeName', 'Render adapter')} aside={<span className={valid ? 'contract-valid' : 'contract-invalid'}>{valid ? 'VALID' : 'INVALID'}</span>} />
      <label className="surface-field" htmlFor={nameId}><span>서비스 이름</span><input id={nameId} value={stringValue(state, 'nodeName', 'Render adapter')} onChange={(event) => onControlChange('nodeName', event.currentTarget.value)} /></label>
      <label className="surface-field" htmlFor={schemaId}><span>입출력 계약</span><textarea id={schemaId} rows={2} spellCheck={false} value={stringValue(state, 'schemaDraft', 'PaintReceipt → SurfaceState')} onChange={(event) => onControlChange('schemaDraft', event.currentTarget.value)} /></label>
      <pre className="contract-diff"><code><span>+</span> changedElements[]<br /><span>+</span> alignmentErrorPx ≤ 2</code></pre>
      <div className="surface-actions"><button type="button" onClick={() => onAction('cancelNodeEdit')}>편집 취소</button><button type="button" onClick={() => onAction('undoNode')}>이전 저장본</button><button className="surface-cta" type="button" disabled={!valid} onClick={() => onAction('saveNode')}>계약 저장</button></div>
      {boolValue(state, 'nodeSaved') && <p className="surface-toast" role="status">Revision {formatQuantity(numberValue(state, 'editRevision', 1))} · {stringValue(state, 'savedNodeName', stringValue(state, 'nodeName', 'Render adapter'))} 계약과 그래프 연결 상태가 저장되었습니다.</p>}
    </>
  );
}

function FloorplanSurface({ runtime, state, fieldId, onControlChange, onAction }: SurfaceBodyProps) {
  const noteId = fieldId('review-note');
  const width = Math.round(runtime.widthMm ?? 8_400);
  const height = Math.round(runtime.heightMm ?? 6_200);
  return (
    <>
      <SurfaceHeading eyebrow="BIM ISSUE · C4 / 2F" title="출입문 회전 반경" aside={<span className="issue-status">REV 12</span>} />
      <table className="measurement-table"><caption>선택 구간 치수</caption><tbody><tr><th scope="row">가로</th><td>{formatQuantity(width)} mm</td></tr><tr><th scope="row">세로</th><td>{formatQuantity(height)} mm</td></tr><tr><th scope="row">허용 오차</th><td>± 5 mm</td></tr></tbody></table>
      <label className="surface-field" htmlFor={noteId}><span>검토 코멘트</span><textarea id={noteId} rows={2} value={stringValue(state, 'reviewNote', '가구 동선과 문짝의 회전 반경이 겹칩니다.')} onChange={(event) => onControlChange('reviewNote', event.currentTarget.value)} /></label>
      <div className="issue-assignment"><label>담당자<select value={stringValue(state, 'assignee', '김설계')} onChange={(event) => onControlChange('assignee', event.currentTarget.value)}><option>김설계</option><option>박시공</option><option>이지원</option></select></label><button className="surface-cta" type="button" onClick={() => onControlChange('reviewPinned', true)}>{boolValue(state, 'reviewPinned') ? '좌표에 게시됨' : '좌표에 게시'}</button></div>
      <button className="surface-cta" type="button" onClick={() => onAction('prepareReviewPacket')}>{boolValue(state, 'reviewPacketReady') ? 'Worker 검토 패킷 준비됨' : '합성 검토 패킷 준비'}</button>
      {boolValue(state, 'reviewPacketReady') && <p className="surface-toast" role="status">현재 치수·코멘트·좌표 snapshot이 worker 합성 패킷으로 고정되었습니다.</p>}
    </>
  );
}

function DataSurface({ runtime, state, onControlChange, onAction }: SurfaceBodyProps) {
  const start = Math.round(numberValue(state, 'brushStartPercent', runtime.brushStartPercent ?? 22));
  const end = Math.round(numberValue(state, 'brushEndPercent', runtime.brushEndPercent ?? 64));
  const metric = stringValue(state, 'metric', '온도');
  return (
    <>
      <SurfaceHeading eyebrow="SEMANTIC BRUSH LENS" title={`${start}% — ${end}% 구간`} aside={<span className="data-confidence">94% 신뢰</span>} />
      <p className="data-rationale">선택 구간의 {metric} 추세는 기준선보다 빠르게 상승하며, 마지막 20%에서 변화 폭이 가장 큽니다.</p>
      <table className="data-table"><caption>{metric} 선택 구간 관측값</caption><thead><tr><th scope="col">시점</th><th scope="col">변화</th><th scope="col">신뢰</th></tr></thead><tbody><tr><td>2016</td><td>+0.8°C</td><td>91%</td></tr><tr><td>2021</td><td>+1.2°C</td><td>93%</td></tr><tr><td>2026</td><td>+1.7°C</td><td>94%</td></tr></tbody></table>
      <div className="brush-keyboard-controls" role="group" aria-label="키보드 브러시 구간"><label><span>시작</span><input aria-label="브러시 시작" type="range" min="0" max={Math.max(0, end - 1)} value={start} onChange={(event) => onControlChange('brushStartPercent', Number(event.currentTarget.value))} /><output>{formatQuantity(start)}%</output></label><label><span>끝</span><input aria-label="브러시 끝" type="range" min={Math.min(100, start + 1)} max="100" value={end} onChange={(event) => onControlChange('brushEndPercent', Number(event.currentTarget.value))} /><output>{formatQuantity(end)}%</output></label></div>
      <div className="surface-actions"><label><input type="checkbox" checked={boolValue(state, 'compare', true)} onChange={(event) => onControlChange('compare', event.currentTarget.checked)} /> 기준선 비교</label><button type="button" onClick={() => onAction('copyRationale')}>근거 복사</button></div>
      {boolValue(state, 'rationaleCopied') && <p className="surface-toast" role="status">선택 구간 근거가 복사 준비 상태로 보존되었습니다.</p>}
    </>
  );
}

function MediaSurface({ runtime, state, fieldId, onControlChange }: SurfaceBodyProps) {
  const captionId = fieldId('caption');
  const current = Math.floor(runtime.currentTimeSeconds ?? numberValue(state, 'currentTime', 42));
  return (
    <>
      <SurfaceHeading eyebrow={`CAPTION CUE · 00:${String(current).padStart(2, '0')}`} title="Live transcript surface" aside={<span className="caption-quality">SAFE AREA ✓</span>} />
      <label className="caption-editor" htmlFor={captionId}><span>KO · 자막</span><textarea id={captionId} rows={2} value={stringValue(state, 'caption', '픽셀 뒤에서도 이 문장은 선택하고 수정할 수 있습니다.')} onChange={(event) => onControlChange('caption', event.currentTarget.value)} /></label>
      <div className="caption-timeline"><button type="button" aria-label={boolValue(state, 'playing', true) ? '일시정지' : '재생'} onClick={() => onControlChange('playing', !boolValue(state, 'playing', true))}>{boolValue(state, 'playing', true) ? 'Ⅱ' : '▶'}</button><input aria-label="재생 위치" type="range" min="0" max="120" value={current} onChange={(event) => onControlChange('currentTime', Number(event.currentTarget.value))} /><output>00:{String(current).padStart(2, '0')}</output></div>
      <div className="shader-readout"><span>refraction <strong>{formatQuantity(numberValue(state, 'distortion', 42))}%</strong></span><span>split <strong>{formatQuantity(numberValue(state, 'chromatic', 8))} px</strong></span></div>
    </>
  );
}

function ScienceSurface({ state, fieldId, onControlChange, onAction }: SurfaceBodyProps) {
  const gravityId = fieldId('gravity');
  const orbitStep = Math.max(0, Math.floor(numberValue(state, 'orbitStep', 0)));
  const gravity = numberValue(state, 'gravity', 100) / 100;
  const velocity = numberValue(state, 'velocity', 92) / 100;
  const period = 8.2 * Math.sqrt(1 / gravity) / Math.max(.45, velocity);
  const eccentricity = Math.min(.98, Math.abs(1 - velocity / Math.sqrt(gravity)));
  const history = stringValue(state, 'orbitHistory', '').split(';').filter(Boolean).slice(-3).reverse();
  return (
    <>
      <SurfaceHeading eyebrow="PERIAPSIS · DERIVATION 03" title="왜 궤도가 타원이 되는가" aside={<span className="hypothesis-state">STEP {formatQuantity(orbitStep)} · {boolValue(state, 'hypothesisSaved') ? 'SAVED' : 'DRAFT'}</span>} />
      <math display="block" aria-label="타원 궤도의 에너지 식"><mrow><mi>E</mi><mo>=</mo><mfrac><mrow><mi>m</mi><msup><mi>v</mi><mn>2</mn></msup></mrow><mn>2</mn></mfrac><mo>−</mo><mfrac><mrow><mi>G</mi><mi>M</mi><mi>m</mi></mrow><mi>r</mi></mfrac></mrow></math>
      <p className="derivation-copy">속도가 탈출 속도보다 작고 총에너지가 음수이면 천체는 닫힌 타원 궤도를 유지합니다.</p>
      <dl className="science-readout"><div><dt>예측 주기</dt><dd>{period.toFixed(2)} s</dd></div><div><dt>편심</dt><dd>{eccentricity.toFixed(3)}</dd></div></dl>
      <label className="derivation-control" htmlFor={gravityId}><span>중력 계수</span><input id={gravityId} type="range" min="20" max="180" step="5" value={numberValue(state, 'gravity', 100)} onChange={(event) => onControlChange('gravity', Number(event.currentTarget.value))} /><output>{formatQuantity(numberValue(state, 'gravity', 100))}%</output></label>
      <div className="surface-actions"><button type="button" onClick={() => onAction('stepOrbit')}>1단계 진행</button><button className="surface-cta" type="button" onClick={() => onAction('saveHypothesis')}>{boolValue(state, 'hypothesisSaved') ? '현재 계산 저장됨' : '계산 이력 저장'}</button></div>
      {history.length > 0 && <ol className="orbit-history" aria-label="저장된 계산 이력">{history.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol>}
    </>
  );
}

function CommerceSurface({ state, fieldId, onControlChange }: SurfaceBodyProps) {
  const materialId = fieldId('material');
  const quantityId = fieldId('quantity');
  const quantity = Math.max(1, Math.min(9, numberValue(state, 'quantity', 1)));
  const price = 248_000 * quantity;
  const submit = (event: FormEvent) => { event.preventDefault(); onControlChange('reserved', true); };
  return (
    <form onSubmit={submit}>
      <SurfaceHeading eyebrow="AURA 04 · LIVE VARIANT" title="Sculptural lamp" aside={<span className="availability">오늘 발송 · 3개</span>} />
      <div className="commerce-price"><span>구성 가격</span><strong>₩{formatQuantity(price)}</strong><small>세금 포함</small></div>
      <label className="surface-field" htmlFor={materialId}><span>표면 재질</span><select id={materialId} value={stringValue(state, 'material', 'Glass')} onChange={(event) => onControlChange('material', event.currentTarget.value)}>{['Glass', 'Frosted', 'Iridescent', 'Metal', 'Ceramic'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="quantity-stepper" htmlFor={quantityId}><span>수량</span><button type="button" aria-label="수량 줄이기" onClick={() => onControlChange('quantity', Math.max(1, quantity - 1))}>−</button><input id={quantityId} inputMode="numeric" value={quantity} onChange={(event) => onControlChange('quantity', Math.max(1, Number(event.currentTarget.value.replace(/,/g, '')) || 1))} /><button type="button" aria-label="수량 늘리기" onClick={() => onControlChange('quantity', Math.min(9, quantity + 1))}>+</button></label>
      <button className="surface-cta" type="submit">{boolValue(state, 'reserved') ? '구성이 예약되었습니다' : '이 구성 예약'}</button>
    </form>
  );
}

function TwinSurface({ runtime, state, fieldId, onControlChange, onAction }: SurfaceBodyProps) {
  const index = selectedIndex(runtime, 'selectedEquipment', 3);
  const equipment = `AHU-${String(index + 1).padStart(2, '0')}`;
  const thresholdId = fieldId('threshold');
  const load = Math.round(runtime.selectedEquipmentLoad ?? 78);
  const acknowledged = boolValue(state, 'acknowledged');
  return (
    <>
      <SurfaceHeading eyebrow={`${equipment} · LIVE EQUIPMENT`} title={acknowledged ? '알람 확인 완료' : load >= 85 ? '즉시 점검 필요' : '진동 추세 경고'} aside={<span className={acknowledged ? 'alarm-ack' : 'alarm-live'}>{acknowledged ? 'ACK' : 'ALARM 01'}</span>} />
      <div className="equipment-trend" aria-label={`현재 부하 ${load}%`}><span style={{ '--trend-value': `${load}%` } as CSSProperties} /><div><strong>{load}%</strong><small>지난 15분 +8%</small></div></div>
      <label className="threshold-control" htmlFor={thresholdId}><span>경고 임계치</span><input id={thresholdId} type="range" min="40" max="95" value={numberValue(state, 'threshold', 72)} onChange={(event) => onControlChange('threshold', Number(event.currentTarget.value))} /><output>{formatQuantity(numberValue(state, 'threshold', 72))}%</output></label>
      <ol className="runbook-preview"><li>베어링 온도 확인</li><li>진동 센서 교차 검증</li><li>필요 시 예비 장치 전환</li></ol>
      <div className="surface-actions"><button type="button" onClick={() => onAction('openRunbook')}>런북 열기</button><button type="button" onClick={() => onAction('escalateAlarm')}>에스컬레이션</button><button className="surface-cta" type="button" onClick={() => onAction('acknowledge')}>{acknowledged ? '확인 기록됨' : '알람 확인'}</button></div>
      <div className="surface-actions"><button type="button" aria-pressed={stringValue(state, 'panelLod', 'detail') === 'compact'} onClick={() => onControlChange('panelLod', stringValue(state, 'panelLod', 'detail') === 'detail' ? 'compact' : 'detail')}>{stringValue(state, 'panelLod', 'detail') === 'detail' ? '원거리 LOD 보기' : '상세 LOD 보기'}</button><button type="button" aria-pressed={boolValue(state, 'panelOccluded')} onClick={() => onControlChange('panelOccluded', !boolValue(state, 'panelOccluded'))}>{boolValue(state, 'panelOccluded') ? '가림 해제' : '설비 뒤 가림 테스트'}</button></div>
      {(boolValue(state, 'runbookOpen') || boolValue(state, 'escalated')) && <p className="surface-toast" role="status">{boolValue(state, 'runbookOpen') ? '런북 3단계가 활성화되었습니다.' : ''}{boolValue(state, 'runbookOpen') && boolValue(state, 'escalated') ? ' · ' : ''}{boolValue(state, 'escalated') ? '시설 운영팀으로 에스컬레이션되었습니다.' : ''}</p>}
    </>
  );
}

const BODIES: Record<DemoDefinition['id'], (props: SurfaceBodyProps) => ReactNode> = {
  portfolio: PortfolioSurface,
  motion: MotionSurface,
  game: GameSurface,
  spatial: SpatialSurface,
  map: MapSurface,
  diagram: DiagramSurface,
  floorplan: FloorplanSurface,
  data: DataSurface,
  media: MediaSurface,
  science: ScienceSurface,
  commerce: CommerceSurface,
  twin: TwinSurface,
};

const SemanticDomainSurfaceBase = forwardRef<HTMLElement, SemanticDomainSurfaceProps>(function SemanticDomainSurface(
  { demo, state, runtime, binding, mode, variant, diagnostics, fallbackReason, onControlChange, onAction },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const fieldId = (name: string) => `${demo.id}-${name}-${uid}`;
  const scrollCueId = `${demo.id}-scroll-cue-${uid}`;
  const surfaceElementId = `${demo.id}-task-surface-${uid}`;
  const Body = BODIES[demo.id];
  const sheetExpanded = boolValue(state, 'sheetExpanded');
  const snapshotPhase = diagnostics?.snapshotPhase ?? (mode === 'dom-overlay' ? 'current' : 'awaiting-first');
  const alignmentError = diagnostics?.alignmentErrorPx;
  const fallback = fallbackReason ?? (mode === 'dom-overlay' ? 'native-contract-unavailable' : 'none');
  const nativeSource = variant === 'native-source';
  const articleRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => articleRef.current as HTMLElement);
  const nativeProofCurrent = Boolean(diagnostics?.ready) && snapshotPhase === 'current' && diagnostics?.failure === 'none';
  const interactiveTask = !nativeSource || nativeProofCurrent;
  useEffect(() => {
    if (!interactiveTask || !articleRef.current) return;
    articleRef.current.scrollTop = 0;
    articleRef.current.scrollLeft = 0;
  }, [demo.id, interactiveTask, sheetExpanded]);
  const executionLabel = nativeSource
    ? nativeProofCurrent ? '네이티브 HTML 조작면' : '네이티브 paint source 확인 중'
    : mode.startsWith('native-')
      ? nativeProofCurrent ? '네이티브 paint + DOM 조작면' : '네이티브 확인 중 + DOM 조작면'
    : mode === 'dom-overlay'
      ? '대체 경로 · DOM'
      : '렌더링 일시 중지';
  // A native source must not write paint-derived diagnostics back into its own
  // layout subtree. Doing so creates a self-sustaining paint → React mutation →
  // paint loop. Native receipts live on the app shell and receipt drawer.
  const sourceOwnsReceipt = interactiveTask;
  const style = {
    '--surface-tint': demo.accent,
    '--binding-w': `${binding.placement.width}px`,
    '--binding-h': `${binding.placement.height}px`,
  } as CSSProperties;

  return (
    <article
      ref={articleRef}
      id={surfaceElementId}
      className={`semantic-surface surface--${binding.archetype} ${variant} ${interactiveTask && sheetExpanded ? 'sheet-expanded' : ''}`}
      data-domain={demo.id}
      data-lane={binding.transformOwner}
      data-mode={mode}
      data-surface-variant={variant}
      data-task-surface-role={interactiveTask ? 'interactive-task' : 'native-paint-source'}
      data-html-paint-source={nativeSource ? 'true' : 'false'}
      data-surface-instance={nativeSource ? nativeProofCurrent ? 'interactive-native-source' : 'pending-native-source' : variant === 'fallback-overlay' ? 'fallback-overlay' : 'interactive-companion'}
      data-native-proof-state={mode.startsWith('native-') ? nativeProofCurrent ? 'current' : 'pending-or-failed' : 'not-applicable'}
      data-surface-id={binding.surfaceId}
      data-object-id={binding.objectId}
      data-surface-archetype={binding.archetype}
      data-binding-x={binding.anchor.x.toFixed(2)}
      data-binding-y={binding.anchor.y.toFixed(2)}
      data-binding-z={binding.anchor.z.toFixed(2)}
      data-placement-x={binding.placement.x.toFixed(2)}
      data-placement-y={binding.placement.y.toFixed(2)}
      data-placement-width={binding.placement.width.toFixed(2)}
      data-placement-height={binding.placement.height.toFixed(2)}
      data-transform-owner={binding.transformOwner}
      data-alignment-error-px={sourceOwnsReceipt && alignmentError != null ? alignmentError.toFixed(3) : sourceOwnsReceipt ? 'unmeasured' : 'external-receipt'}
      data-snapshot-phase={sourceOwnsReceipt ? snapshotPhase : 'external-receipt'}
      data-fallback-reason={sourceOwnsReceipt ? fallback : 'none'}
      data-occluded={String(binding.occluded)}
      aria-hidden={nativeSource && !nativeProofCurrent ? true : undefined}
      inert={nativeSource && !nativeProofCurrent ? true : undefined}
      aria-label={interactiveTask ? `${demo.shortTitle} ${binding.archetype} HTML 조작면` : undefined}
      aria-describedby={interactiveTask ? scrollCueId : undefined}
      tabIndex={interactiveTask ? 0 : -1}
      onPointerDown={interactiveTask ? (event) => event.stopPropagation() : undefined}
      onPointerMove={interactiveTask ? (event) => event.stopPropagation() : undefined}
      onPointerUp={interactiveTask ? (event) => event.stopPropagation() : undefined}
      onWheel={interactiveTask ? (event) => event.stopPropagation() : undefined}
      style={style}
    >
      <Body demo={demo} state={state} runtime={runtime} binding={binding} mode={mode} fieldId={fieldId} onControlChange={onControlChange} onAction={onAction} />
      {interactiveTask && <span id={scrollCueId} className="sr-only">이 작업 패널은 내부를 스크롤할 수 있으며 모바일에서는 펼치거나 접을 수 있습니다.</span>}
      <footer className="surface-receipt-line">
        <span className="surface-execution-status"><i />{executionLabel}</span>
        {interactiveTask && <button
          className="surface-sheet-toggle"
          type="button"
          aria-controls={surfaceElementId}
          aria-expanded={sheetExpanded}
          onClick={() => onControlChange('sheetExpanded', !sheetExpanded)}
        >{sheetExpanded ? '작업면 접기' : '↕ 스크롤 · 작업면 펼치기'}</button>}
        <small>{binding.objectId}</small>
      </footer>
    </article>
  );
});

export const SemanticDomainSurface = memo(SemanticDomainSurfaceBase, (previous, next) => {
  const samePlacement =
    previous.binding.surfaceId === next.binding.surfaceId &&
    previous.binding.objectId === next.binding.objectId &&
    previous.binding.archetype === next.binding.archetype &&
    previous.binding.transformOwner === next.binding.transformOwner &&
    previous.binding.visible === next.binding.visible &&
    previous.binding.occluded === next.binding.occluded &&
    previous.binding.placement.x === next.binding.placement.x &&
    previous.binding.placement.y === next.binding.placement.y &&
    previous.binding.placement.width === next.binding.placement.width &&
    previous.binding.placement.height === next.binding.placement.height &&
    previous.binding.anchor.x === next.binding.anchor.x &&
    previous.binding.anchor.y === next.binding.anchor.y &&
    previous.binding.anchor.z === next.binding.anchor.z;
  const runtimeSignature = (props: SemanticDomainSurfaceProps) => {
    switch (props.demo.id) {
      case 'game': return `${signalCount(props.runtime.collected ?? 0)}:${props.runtime.exitUnlocked ?? 0}:${props.runtime.escaped ?? 0}`;
      case 'floorplan': return `${Math.round(props.runtime.widthMm ?? 8_400)}:${Math.round(props.runtime.heightMm ?? 6_200)}`;
      case 'data': return `${Math.round(props.runtime.brushStartPercent ?? 22)}:${Math.round(props.runtime.brushEndPercent ?? 64)}`;
      case 'media': return Math.floor(props.runtime.currentTimeSeconds ?? numberValue(props.state, 'currentTime', 42));
      case 'twin': return Math.round(props.runtime.selectedEquipmentLoad ?? 78);
      default: return 'static';
    }
  };
  const stableTaskProps =
    previous.demo === next.demo &&
    previous.state === next.state &&
    runtimeSignature(previous) === runtimeSignature(next) &&
    samePlacement &&
    previous.mode === next.mode &&
    previous.variant === next.variant &&
    previous.onControlChange === next.onControlChange &&
    previous.onAction === next.onAction;
  if (!stableTaskProps) return false;
  if (next.variant === 'native-source') {
    const proofCurrent = (props: SemanticDomainSurfaceProps) => Boolean(props.diagnostics?.ready)
      && props.diagnostics?.snapshotPhase === 'current'
      && props.diagnostics?.failure === 'none';
    // Native paint receipts change on every frame. Only the one-way proof state
    // transition may re-render the source, which promotes it into the native
    // hit-test/accessibility surface without creating a paint feedback loop.
    return proofCurrent(previous) === proofCurrent(next);
  }
  return previous.diagnostics === next.diagnostics && previous.fallbackReason === next.fallbackReason;
});
