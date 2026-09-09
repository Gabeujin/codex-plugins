import type { DemoDefinition, DemoId, DemoState } from './types';

export const DEMOS: DemoDefinition[] = [
  {
    id: 'portfolio', index: '01', eyebrow: 'Portfolio Atlas', shortTitle: 'Portfolio', icon: '◫', renderer: 'Canvas 2D', accent: '#45d6e8',
    title: '작품 사이의 관계를 탐색하세요',
    description: '선택·복사·검색 가능한 실제 사례 HTML을 프로젝트 성좌의 좌표에 합성하는 포트폴리오.',
    instruction: '노드를 움직인 뒤 사례 표면의 프로젝트 선택과 링크를 직접 조작해 보세요.',
    metrics: [{ label: '작품', value: '24' }, { label: '연결', value: '68' }, { label: '기간', value: '6년' }],
    controls: [
      { type: 'select', key: 'discipline', label: '분야', value: '전체', options: ['전체', '제품', '공간', '브랜드'] },
      { type: 'range', key: 'density', label: '연결 밀도', min: 2, max: 10, step: 1, value: 6 },
      { type: 'toggle', key: 'labels', label: '프로젝트 레이블', value: true },
    ],
  },
  {
    id: 'motion', index: '02', eyebrow: 'Motion Studio', shortTitle: 'Motion', icon: '⌁', renderer: 'WebGL', accent: '#b48cff',
    title: '움직임의 성격을 조율하세요',
    description: '편집 가능한 모션 명세 HTML을 실제 WebGL 텍스처로 굴절시키는 프로토타이핑 스튜디오.',
    instruction: '명세 문장을 편집하고 이징을 바꿔 DOM → paint → texture 갱신을 확인하세요.',
    metrics: [{ label: '지속', value: '680ms' }, { label: '샘플', value: '120' }, { label: '루프', value: '활성' }],
    controls: [
      { type: 'select', key: 'easing', label: '이징', value: 'Fluid', options: ['Fluid', 'Expressive', 'Precise', 'Elastic'] },
      { type: 'range', key: 'duration', label: '지속 시간', min: 180, max: 1800, step: 20, value: 680, suffix: 'ms' },
      { type: 'toggle', key: 'trail', label: '잔상 표시', value: true },
    ],
  },
  {
    id: 'game', index: '03', eyebrow: 'Signal Runner', shortTitle: '2D Game', icon: '✣', renderer: 'Canvas 2D', accent: '#63e6be',
    title: '신호를 모아 출구를 여세요',
    description: '키보드·IME가 가능한 실제 미션 터미널을 게임 월드 좌표에 합성한 2D 실험.',
    instruction: '드론을 이동한 뒤 터미널 호출명을 입력하고 게이트를 인증하세요.',
    metrics: [{ label: '신호', value: '0 / 6' }, { label: '시간', value: '00:00' }, { label: '시드', value: '0312' }],
    controls: [
      { type: 'range', key: 'speed', label: '이동 감도', min: 2, max: 10, step: 1, value: 6 },
      { type: 'toggle', key: 'assist', label: '경로 힌트', value: true },
      { type: 'button', key: 'resetGame', label: '게임 다시 시작' },
    ],
  },
  {
    id: 'spatial', index: '04', eyebrow: 'Spatial Gallery', shortTitle: '3D Studio', icon: '◇', renderer: 'WebGL', accent: '#6ea8ff',
    title: '공간 속 큐레이션을 설계하세요',
    description: '큐레이션 HTML을 실제 원근 mesh 텍스처로 업로드하고 상호작용 위치를 동기화하는 갤러리.',
    instruction: '스테이지를 드래그해 좌우(Yaw)·상하(Pitch) 시점을 조절한 뒤, 정면에서 HTML 작품 정보를 편집해 보세요.',
    metrics: [{ label: '작품', value: '9' }, { label: 'FOV', value: '42°' }, { label: '레이어', value: '3' }],
    controls: [
      { type: 'range', key: 'depth', label: '전시실 깊이', min: 4, max: 18, step: 1, value: 10 },
      { type: 'range', key: 'perspective', label: '원근', min: 24, max: 70, step: 1, value: 42, suffix: '°' },
      { type: 'toggle', key: 'htmlSurface', label: 'HTML 작품 레이블', value: true },
    ],
  },
  {
    id: 'map', index: '05', eyebrow: 'Living City Map', shortTitle: 'Maps', icon: '⌖', renderer: 'Canvas 2D', accent: '#45d6e8',
    title: '도시의 흐름을 확대해 보세요',
    description: '다국어 장소 카드와 검색 폼을 지도 좌표에 합성하는 패닝·줌 실험.',
    instruction: '지도를 이동·확대한 뒤 장소를 검색하고 카드 고정 상태를 바꿔보세요.',
    metrics: [{ label: '구역', value: '12' }, { label: '이동량', value: '18,420' }, { label: '확대', value: '1.0×' }],
    controls: [
      { type: 'range', key: 'zoom', label: '지도 확대', min: 50, max: 240, step: 10, value: 100, suffix: '%' },
      { type: 'select', key: 'layer', label: '데이터 레이어', value: '이동량', options: ['이동량', '녹지', '에너지', '보행'] },
      { type: 'toggle', key: 'pulse', label: '실시간 펄스', value: true },
    ],
  },
  {
    id: 'diagram', index: '06', eyebrow: 'Flowboard', shortTitle: 'Diagram', icon: '⌘', renderer: 'SVG + Canvas', accent: '#ffca6e',
    title: '시스템의 흐름을 다시 연결하세요',
    description: '코드·폼·상태를 가진 실제 HTML 노드를 그래프 좌표에 합성하는 아키텍처 편집기.',
    instruction: '노드를 드래그하고 이름과 상태를 편집한 뒤 다시 배치하세요.',
    metrics: [{ label: '노드', value: '8' }, { label: '경로', value: '11' }, { label: '상태', value: '정상' }],
    controls: [
      { type: 'select', key: 'layout', label: '레이아웃', value: 'Flow', options: ['Flow', 'Radial', 'Stack'] },
      { type: 'range', key: 'spacing', label: '노드 간격', min: 60, max: 180, step: 10, value: 110, suffix: 'px' },
      { type: 'button', key: 'autoLayout', label: '자동 정렬' },
    ],
  },
  {
    id: 'floorplan', index: '07', eyebrow: 'Plan Lab', shortTitle: 'Floor plan', icon: '▦', renderer: 'Hybrid', accent: '#ff6b55',
    title: '공간을 밀리미터 단위로 조정하세요',
    description: 'BIM 검토 HTML을 ElementImage로 캡처해 OffscreenCanvas worker에 합성하는 평면도 편집기.',
    instruction: '치수와 스냅을 바꾸고 검토 코멘트를 작성해 도면에 고정하세요.',
    metrics: [{ label: '면적', value: '84.6㎡' }, { label: '벽체', value: '18' }, { label: '축척', value: '1:100' }],
    controls: [
      { type: 'range', key: 'grid', label: '스냅 간격', min: 100, max: 1000, step: 100, value: 500, suffix: 'mm' },
      { type: 'toggle', key: 'dimensions', label: '치수선 표시', value: true },
      { type: 'select', key: 'planLayer', label: '레이어', value: '전체', options: ['전체', '구조', '가구', '동선'] },
    ],
  },
  {
    id: 'data', index: '08', eyebrow: 'Climate Lens', shortTitle: 'Data', icon: '▥', renderer: 'Canvas 2D', accent: '#63e6be',
    title: '변화의 구간을 직접 선택하세요',
    description: '접근 가능한 실제 데이터 표를 차트에 직접 합성하는 브러시·비교 기후 탐색기.',
    instruction: '기간을 브러시로 선택하고 합성된 표에서 값과 비교 상태를 확인하세요.',
    metrics: [{ label: '관측', value: '4,380' }, { label: '변화', value: '+1.7°C' }, { label: '신뢰도', value: '94%' }],
    controls: [
      { type: 'select', key: 'metric', label: '지표', value: '온도', options: ['온도', '강수', '해수면', '탄소'] },
      { type: 'range', key: 'smoothing', label: '평활화', min: 1, max: 12, step: 1, value: 4 },
      { type: 'toggle', key: 'compare', label: '기준선 비교', value: true },
    ],
  },
  {
    id: 'media', index: '09', eyebrow: 'Shader Cinema', shortTitle: 'Media', icon: '▷', renderer: 'WebGPU', accent: '#b48cff',
    title: '픽셀의 반응을 연출하세요',
    description: '편집 가능한 라이브 자막 HTML을 WebGPU 텍스처로 복사해 shader로 왜곡하는 미디어 실험실.',
    instruction: '자막을 수정하고 왜곡·색 분리를 바꿔 GPU copy 경로를 확인하세요.',
    metrics: [{ label: '패스', value: '2' }, { label: '해상도', value: '1,280 × 720' }, { label: '재생', value: '60 FPS' }],
    controls: [
      { type: 'range', key: 'distortion', label: '왜곡', min: 0, max: 100, step: 1, value: 42, suffix: '%' },
      { type: 'range', key: 'chromatic', label: '색 분리', min: 0, max: 30, step: 1, value: 8, suffix: 'px' },
      { type: 'toggle', key: 'playing', label: '셰이더 재생', value: true },
    ],
  },
  {
    id: 'science', index: '10', eyebrow: 'Orbit Classroom', shortTitle: 'Science', icon: '✺', renderer: 'Canvas 2D', accent: '#6ea8ff',
    title: '궤도 변화의 원인을 실험하세요',
    description: '실제 MathML 설명과 변수를 궤도 장면에 합성하는 과학 학습 시뮬레이션.',
    instruction: '중력과 속도를 바꾼 뒤 MathML 가설 카드의 paint 갱신을 확인하세요.',
    metrics: [{ label: '주기', value: '8.2s' }, { label: '편심', value: '0.12' }, { label: '시도', value: '1' }],
    controls: [
      { type: 'range', key: 'gravity', label: '중력', min: 20, max: 180, step: 5, value: 100, suffix: '%' },
      { type: 'range', key: 'velocity', label: '초기 속도', min: 30, max: 160, step: 5, value: 92, suffix: '%' },
      { type: 'toggle', key: 'vectors', label: '힘 벡터', value: true },
    ],
  },
  {
    id: 'commerce', index: '11', eyebrow: 'Spatial Commerce', shortTitle: 'Commerce', icon: '♧', renderer: 'Hybrid', accent: '#ff6b55',
    title: '빛과 재질을 직접 설계하세요',
    description: '실제 제품 구성 폼을 WebGL mesh 텍스처로 쓰는 공간형 커머스 구성기.',
    instruction: '스테이지를 드래그해 제품의 좌우(Yaw)·상하(Pitch) 방향을 조절한 뒤, 정면에서 HTML 구성 폼의 재질·광원·저장 상태를 바꿔보세요.',
    metrics: [{ label: '재질', value: 'Glass' }, { label: '각도', value: '0°' }, { label: '가격', value: '₩248,000' }],
    controls: [
      { type: 'select', key: 'material', label: '재질', value: 'Glass', options: ['Glass', 'Frosted', 'Iridescent', 'Metal', 'Ceramic'] },
      { type: 'range', key: 'light', label: '광원 세기', min: 20, max: 180, step: 5, value: 100, suffix: '%' },
      { type: 'range', key: 'rotation', label: '드래그 감도', min: 10, max: 100, step: 2, value: 42, suffix: '%' },
      { type: 'toggle', key: 'htmlSurface', label: 'HTML 제품 표면', value: true },
    ],
  },
  {
    id: 'twin', index: '12', eyebrow: 'Digital Twin', shortTitle: 'Twin', icon: '◎', renderer: 'Hybrid', accent: '#ffca6e',
    title: '운영 상태를 공간 위에서 판단하세요',
    description: '실제 알람·임계치 폼을 설비의 공간 panel 텍스처로 합성하는 운영 콘솔.',
    instruction: '설비를 선택하고 공간 panel에서 임계치를 바꾸고 알람을 확인하세요.',
    metrics: [{ label: '설비', value: '18' }, { label: '온라인', value: '17' }, { label: '알람', value: '1' }],
    controls: [
      { type: 'select', key: 'zone', label: '운영 구역', value: 'A동', options: ['A동', 'B동', '옥상', '에너지실'] },
      { type: 'range', key: 'threshold', label: '경고 임계치', min: 40, max: 95, step: 1, value: 72, suffix: '%' },
      { type: 'toggle', key: 'live', label: '실시간 동기화', value: true },
      { type: 'button', key: 'acknowledge', label: '알람 확인' },
    ],
  },
];

export const DEMO_BY_ID = new Map<DemoId, DemoDefinition>(DEMOS.map((demo) => [demo.id, demo]));

const DOMAIN_STATE_DEFAULTS: Record<DemoId, DemoState> = {
  portfolio: { selectedArtifact: 'Prototype', artifactOpen: false },
  motion: { motionNote: '도착 직전 감속으로 상태의 확정을 설명합니다.', motionScrub: 64 },
  game: { callSign: '캔버스-01', gateOpen: false, collectedMask: 0, gameEscaped: false },
  spatial: { artworkApproved: false, provenanceOpen: false, artworkPinned: false, artworkExpanded: false },
  map: { placeQuery: '성수', mapPinned: false, incidentSeverity: 'delay', routeLanguage: 'ko' },
  diagram: {
    nodeName: 'Render adapter',
    schemaDraft: 'PaintReceipt → SurfaceState',
    savedNodeName: 'Render adapter',
    savedSchema: 'PaintReceipt → SurfaceState',
    nodeHealthy: true,
    nodeSaved: false,
    editRevision: 0,
    nodeHistory: '',
  },
  floorplan: { reviewNote: '가구 동선과 문짝의 회전 반경이 겹칩니다.', assignee: '김설계', reviewPinned: false, reviewPacketReady: false },
  data: { brushStartPercent: 22, brushEndPercent: 64, rationaleCopied: false },
  media: { caption: '픽셀 뒤에서도 이 문장은 선택하고 수정할 수 있습니다.', currentTime: 42 },
  science: { orbitStep: 0, hypothesisSaved: false, orbitHistory: '', savedOrbitSignature: '' },
  commerce: { quantity: 1, reserved: false },
  twin: { acknowledged: false, runbookOpen: false, escalated: false, panelLod: 'detail', panelOccluded: false },
};

export function createInitialState(demo: DemoDefinition): DemoState {
  return {
    ...Object.fromEntries(demo.controls.filter((control) => control.type !== 'button').map((control) => [control.key, control.value])),
    ...DOMAIN_STATE_DEFAULTS[demo.id],
  };
}

export function demoFromHash(hash: string): DemoId {
  const id = hash.replace(/^#\/?/, '').split('/')[0] as DemoId;
  return DEMO_BY_ID.has(id) ? id : 'commerce';
}
