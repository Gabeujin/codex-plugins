import { forwardRef, useId, type CSSProperties } from 'react';
import { formatQuantity } from '../runtime/format';
import { DOMAIN_SURFACES, laneDisplayName } from '../runtime/surfaceCatalog';
import type { DemoDefinition, DemoState, SceneRuntimeState } from '../types';
import type { HtmlCanvasMode } from '../runtime/htmlInCanvas';

type DomainHtmlSurfaceProps = {
  demo: DemoDefinition;
  state: DemoState;
  runtime: SceneRuntimeState;
  mode: HtmlCanvasMode;
  variant: 'native-source' | 'fallback-overlay';
  onControlChange: (key: string, value: string | number | boolean) => void;
  onAction: (key: string) => void;
};

const stringValue = (state: DemoState, key: string, fallback: string) => String(state[key] ?? fallback);
const numberValue = (state: DemoState, key: string, fallback: number) => Number(state[key] ?? fallback);
const boolValue = (state: DemoState, key: string, fallback = false) => Boolean(state[key] ?? fallback);

export const DomainHtmlSurface = forwardRef<HTMLElement, DomainHtmlSurfaceProps>(function DomainHtmlSurface(
  { demo, state, runtime, mode, variant, onControlChange, onAction },
  ref,
) {
  const definition = DOMAIN_SURFACES[demo.id];
  const uid = useId().replace(/:/g, '');
  const fieldId = (name: string) => `${demo.id}-${name}-${uid}`;

  const body = (() => {
    if (demo.id === 'portfolio') {
      return (
        <>
          <p className="surface-lede">도시의 흐름을 공공 인터페이스로 번역한 선택 가능한 사례 연구입니다.</p>
          <div className="surface-meta-grid"><span>역할<strong>Product / Motion</strong></span><span>기간<strong>18주</strong></span></div>
          <div className="surface-actions" role="group" aria-label="사례 연구 선택">
            {['Signal Commons', 'Transit Bloom'].map((project) => (
              <button type="button" key={project} aria-pressed={stringValue(state, 'selectedProject', 'Signal Commons') === project} onClick={() => onControlChange('selectedProject', project)}>{project}</button>
            ))}
          </div>
          <a href="#accessible-details">사례 데이터로 이동</a>
        </>
      );
    }
    if (demo.id === 'motion') {
      const id = fieldId('motion-note');
      return (
        <>
          <label htmlFor={id}>모션 의도</label>
          <textarea id={id} rows={3} value={stringValue(state, 'motionNote', '도착 직전 감속으로 상태 변화를 설명합니다.')} onChange={(event) => onControlChange('motionNote', event.currentTarget.value)} />
          <div className="surface-readout"><span>curve</span><strong>{String(state.easing ?? 'Fluid')}</strong><span>duration</span><strong>{formatQuantity(numberValue(state, 'duration', 680))} ms</strong></div>
          <button className="surface-primary" type="button" onClick={() => onControlChange('trail', !boolValue(state, 'trail', true))}>{boolValue(state, 'trail', true) ? '잔상 끄기' : '잔상 켜기'}</button>
        </>
      );
    }
    if (demo.id === 'game') {
      const id = fieldId('callsign');
      return (
        <form onSubmit={(event) => { event.preventDefault(); onControlChange('gateOpen', true); }}>
          <p className="terminal-line"><span>root@signal</span>: gate/06 is waiting</p>
          <label htmlFor={id}>드론 호출명</label>
          <input id={id} autoComplete="off" value={stringValue(state, 'callSign', 'CANVAS-01')} onChange={(event) => onControlChange('callSign', event.currentTarget.value)} />
          <p>수집 신호 <strong>{formatQuantity(runtime.collected ?? 0)} / 6</strong></p>
          <button className="surface-primary" type="submit">{boolValue(state, 'gateOpen') ? '게이트 열림' : '게이트 인증'}</button>
        </form>
      );
    }
    if (demo.id === 'spatial') {
      return (
        <>
          <p className="surface-index">08 / LIGHT STUDIES</p>
          <blockquote>“빛의 잔상과 관람자의 이동이 하나의 표면에서 만나는 순간.”</blockquote>
          <div className="surface-meta-grid"><span>작가<strong>Han Sol</strong></span><span>매체<strong>Light / glass</strong></span></div>
          <button className="surface-primary" type="button" onClick={() => onControlChange('selectedArtwork', 'Light Studies 08')}>작품 정보 고정</button>
        </>
      );
    }
    if (demo.id === 'map') {
      const id = fieldId('place-query');
      return (
        <>
          <label htmlFor={id}>장소 검색</label>
          <input id={id} type="search" value={stringValue(state, 'placeQuery', '성수')} onChange={(event) => onControlChange('placeQuery', event.currentTarget.value)} />
          <div className="place-result"><span aria-hidden="true">⌖</span><div><strong>성수 이동 창</strong><small>보행 +18% · 자전거 +12%</small></div></div>
          <p dir="rtl" lang="ar">بطاقة مكان متعددة اللغات</p>
          <button className="surface-primary" type="button" onClick={() => onControlChange('mapPinned', !boolValue(state, 'mapPinned'))}>{boolValue(state, 'mapPinned') ? '고정 해제' : '지도에 고정'}</button>
        </>
      );
    }
    if (demo.id === 'diagram') {
      const id = fieldId('node-name');
      return (
        <>
          <label htmlFor={id}>노드 이름</label>
          <input id={id} value={stringValue(state, 'nodeName', 'Render adapter')} onChange={(event) => onControlChange('nodeName', event.currentTarget.value)} />
          <pre><code>{`paint(event)\n  → upload(changed)\n  → sync(transform)`}</code></pre>
          <label className="surface-check"><input type="checkbox" checked={boolValue(state, 'nodeHealthy', true)} onChange={(event) => onControlChange('nodeHealthy', event.currentTarget.checked)} /> 검증 통과</label>
          <button className="surface-primary" type="button" onClick={() => onAction('autoLayout')}>그래프에 다시 배치</button>
        </>
      );
    }
    if (demo.id === 'floorplan') {
      const id = fieldId('review-note');
      return (
        <>
          <div className="surface-meta-grid"><span>좌표<strong>C4 / 2F</strong></span><span>단위<strong>{formatQuantity(numberValue(state, 'grid', 500))} mm</strong></span></div>
          <label htmlFor={id}>검토 코멘트</label>
          <textarea id={id} rows={3} value={stringValue(state, 'reviewNote', '출입문 회전 반경과 가구 동선을 다시 확인해 주세요.')} onChange={(event) => onControlChange('reviewNote', event.currentTarget.value)} />
          <button className="surface-primary" type="button" onClick={() => onControlChange('reviewPinned', !boolValue(state, 'reviewPinned'))}>{boolValue(state, 'reviewPinned') ? '도면에서 해제' : '도면에 코멘트 고정'}</button>
        </>
      );
    }
    if (demo.id === 'data') {
      return (
        <>
          <table className="surface-table">
            <caption>선택 구간의 기후 관측값</caption>
            <thead><tr><th scope="col">연도</th><th scope="col">온도</th><th scope="col">신뢰도</th></tr></thead>
            <tbody><tr><td>2016</td><td>+0.8°C</td><td>91%</td></tr><tr><td>2021</td><td>+1.2°C</td><td>93%</td></tr><tr><td>2026</td><td>+1.7°C</td><td>94%</td></tr></tbody>
          </table>
          <label className="surface-check"><input type="checkbox" checked={boolValue(state, 'compare', true)} onChange={(event) => onControlChange('compare', event.currentTarget.checked)} /> 기준선과 비교</label>
        </>
      );
    }
    if (demo.id === 'media') {
      const id = fieldId('caption');
      return (
        <>
          <label htmlFor={id}>라이브 자막</label>
          <textarea id={id} rows={3} value={stringValue(state, 'caption', '픽셀 뒤에서도 이 문장은 선택하고 수정할 수 있습니다.')} onChange={(event) => onControlChange('caption', event.currentTarget.value)} />
          <div className="surface-readout"><span>shader</span><strong>{formatQuantity(numberValue(state, 'distortion', 42))}%</strong><span>split</span><strong>{formatQuantity(numberValue(state, 'chromatic', 8))} px</strong></div>
          <button className="surface-primary" type="button" onClick={() => onControlChange('playing', !boolValue(state, 'playing', true))}>{boolValue(state, 'playing', true) ? '효과 일시정지' : '효과 재생'}</button>
        </>
      );
    }
    if (demo.id === 'science') {
      const id = fieldId('gravity');
      return (
        <>
          <p className="surface-lede">중력과 초기 속도가 타원 궤도의 이심률을 함께 결정합니다.</p>
          <math display="block" aria-label="타원 궤도의 에너지 식"><mrow><mi>E</mi><mo>=</mo><mfrac><mrow><mi>m</mi><msup><mi>v</mi><mn>2</mn></msup></mrow><mn>2</mn></mfrac><mo>−</mo><mfrac><mrow><mi>G</mi><mi>M</mi><mi>m</mi></mrow><mi>r</mi></mfrac></mrow></math>
          <label htmlFor={id}>중력 <output>{formatQuantity(numberValue(state, 'gravity', 100))}%</output></label>
          <input id={id} type="range" min="20" max="180" step="5" value={numberValue(state, 'gravity', 100)} onChange={(event) => onControlChange('gravity', Number(event.currentTarget.value))} />
          <button className="surface-primary" type="button" onClick={() => onControlChange('hypothesisSaved', true)}>{boolValue(state, 'hypothesisSaved') ? '가설 저장됨' : '가설 기록'}</button>
        </>
      );
    }
    if (demo.id === 'commerce') {
      const materialId = fieldId('material');
      const lightId = fieldId('light');
      return (
        <form onSubmit={(event) => { event.preventDefault(); onControlChange('reserved', true); }}>
          <div className="product-line"><div aria-hidden="true" /><p><span>총 구성 가격</span><strong>₩248,000</strong></p></div>
          <label htmlFor={materialId}>표면 재질</label>
          <select id={materialId} value={stringValue(state, 'material', 'Glass')} onChange={(event) => onControlChange('material', event.currentTarget.value)}>{['Glass', 'Frosted', 'Iridescent', 'Metal', 'Ceramic'].map((value) => <option key={value}>{value}</option>)}</select>
          <label htmlFor={lightId}>광원 <output>{formatQuantity(numberValue(state, 'light', 100))}%</output></label>
          <input id={lightId} type="range" min="20" max="180" step="5" value={numberValue(state, 'light', 100)} onChange={(event) => onControlChange('light', Number(event.currentTarget.value))} />
          <button className="surface-primary" type="submit">{boolValue(state, 'reserved') ? '구성이 저장됨' : '이 구성 저장'}</button>
        </form>
      );
    }
    const thresholdId = fieldId('threshold');
    return (
      <>
        <div className="alarm-line"><span>ALARM 01</span><strong>{boolValue(state, 'acknowledged') ? '확인 완료' : '점검 필요'}</strong></div>
        <p>AHU-04 진동값이 설정 임계치에 접근했습니다.</p>
        <label htmlFor={thresholdId}>경고 임계치 <output>{formatQuantity(numberValue(state, 'threshold', 72))}%</output></label>
        <input id={thresholdId} type="range" min="40" max="95" value={numberValue(state, 'threshold', 72)} onChange={(event) => onControlChange('threshold', Number(event.currentTarget.value))} />
        <button className="surface-primary" type="button" onClick={() => onAction('acknowledge')}>{boolValue(state, 'acknowledged') ? '알람 확인됨' : '알람 확인'}</button>
      </>
    );
  })();

  return (
    <article
      ref={ref}
      className={`domain-html-surface ${variant}`}
      data-domain={demo.id}
      data-lane={definition.lane}
      data-mode={mode}
      data-surface-variant={variant}
      aria-label={`${demo.shortTitle} HTML-in-Canvas 상호작용 표면`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      style={{ '--surface-tint': definition.tint } as CSSProperties}
    >
      <header>
        <div><span>{definition.kicker}</span><strong>{definition.title}</strong></div>
        <span className="surface-lane">{laneDisplayName(definition.lane)}</span>
      </header>
      <div className="surface-body">{body}</div>
      <footer>
        <span><i />{mode.startsWith('native-') ? 'NATIVE PAINT' : mode === 'dom-overlay' ? 'TASK-EQUIVALENT FALLBACK' : 'SURFACE OFF'}</span>
        <small>{definition.proof}</small>
      </footer>
    </article>
  );
});
