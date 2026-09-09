const phenotypes = {
  operations: {
    label: "Operations",
    fixtureId: "fixture.operations.signal",
    kicker: "ILLUSTRATIVE / OPERATIONS / SEOUL",
    title: "Pulse\nOperations",
    id: "OPS-2026-0144",
    metric: {
      label: "예시 처리 신호 · 최근 15분 · 건",
      value: 12482,
      comparison: "직전 15분보다 8.4% 증가",
      series: [{label:"09시",value:2180},{label:"10시",value:2540},{label:"11시",value:1982},{label:"12시",value:3130},{label:"13시",value:2650}],
      summary: "Operations 예시 신호 12,482건: 09시 2,180건, 10시 2,540건, 11시 1,982건, 12시 3,130건, 13시 2,650건."
    },
    decision: { state: "EXAMPLE DECISION", title: "결제 지연이 임계값을 넘었습니다.", copy: "영향 범위와 복구 경로를 확인한 뒤 트래픽 우회 여부를 결정하세요.", cta: "Operations 근거와 복구 경로 보기" },
    traits: ["Compressed", "Decisive", "State only", "Tight"],
    proof: { verdict:"ILLUSTRATIVE — release evidence가 아닙니다.", evidence:"demo.operations.browser · illustrative browser", scope:"operations console · DNA 1.2 · Dictionary review-only", postCondition:"동일한 fixture가 합계, 시간대별 수치, 접근 가능한 요약, 결정 문구를 함께 갱신합니다.", limitation:"정적 데모 fixture이며 설치·배포·실제 서비스 상태를 증명하지 않습니다.", recovery:"변경 전 routing state를 유지하고 검증 실패 시 트래픽 전환을 중단합니다.", nextAction:"다음 안전한 단계: 검증된 운영 evidence registry와 실제 실행 영수증을 연결하세요." }
  },
  research: {
    label: "Research",
    fixtureId: "fixture.research.evidence",
    kicker: "ILLUSTRATIVE / EVIDENCE NOTE",
    title: "Fieldnote\nResearch",
    id: "RSR-2026-0087",
    metric: {
      label: "예시 검토 근거 · 문서 · 건",
      value: 3816,
      comparison: "상반된 근거 14건을 보류 집합으로 분리",
      series: [{label:"공식",value:1280},{label:"논문",value:946},{label:"기술",value:1104},{label:"사례",value:472},{label:"보류",value:14}],
      summary: "Research 예시 근거 3,816건: 공식 원문 1,280건, 논문 946건, 기술 블로그 1,104건, 사례 472건, 보류 14건."
    },
    decision: { state: "EXAMPLE WITH LIMITS", title: "공통 원칙은 채택하되 외형은 재해석합니다.", copy: "공식 원문과 로컬 사례의 적용 범위를 구분하고, 제품 고유의 정보 리듬으로 다시 구성합니다.", cta: "Research 근거와 한계 보기" },
    traits: ["Editorial", "Measured", "Disclosure", "Planar"],
    proof: { verdict:"ILLUSTRATIVE — 범위가 있는 research fixture입니다.", evidence:"demo.research.sources · illustrative static", scope:"evidence-led report · DNA 1.2 · non-binding candidates", postCondition:"근거 총계, 출처별 분포, 보류 수, 결론의 한계가 하나의 fixture에서 파생됩니다.", limitation:"출처 문서의 실제 유효성이나 최신성을 증명하지 않는 정보 구조 예시입니다.", recovery:"상반된 근거는 삭제하지 않고 보류 상태로 남겨 이전 결론을 재검토할 수 있습니다.", nextAction:"다음 안전한 단계: 공식 원문과 검토 시점이 해시로 묶인 research receipt를 연결하세요." }
  },
  spatial: {
    label: "Spatial",
    fixtureId: "fixture.spatial.relations",
    kicker: "ILLUSTRATIVE / RELATION MAP",
    title: "Orbit\nSpatial",
    id: "SPX-2026-0032",
    metric: {
      label: "예시 활성 관계 · 연결 · 건",
      value: 7604,
      comparison: "5개 영역 모두 DOM 대체 표현과 1:1로 연결",
      series: [{label:"북",value:1240},{label:"동",value:1984},{label:"중앙",value:1428},{label:"서",value:1760},{label:"남",value:1192}],
      summary: "Spatial 예시 관계 7,604건: 북 1,240건, 동 1,984건, 중앙 1,428건, 서 1,760건, 남 1,192건."
    },
    decision: { state: "EXAMPLE FOCUS", title: "선택한 계보가 현재 초점으로 이동했습니다.", copy: "공간 탐색은 캔버스가 담당하지만 의미, 조작, 상태 전달은 동등한 DOM 구조가 보존합니다.", cta: "Spatial 관계 근거와 복구 보기" },
    traits: ["Locus", "Tactile", "Orienting", "Orbital"],
    proof: { verdict:"ILLUSTRATIVE — canvas와 DOM 동등성 예시입니다.", evidence:"demo.spatial.equivalence · illustrative browser", scope:"spatial studio · DNA 1.2 · DOM fallback required", postCondition:"영역별 관계 합계, 선택 상태, 캔버스 강조, DOM 설명이 동일한 fixture를 가리킵니다.", limitation:"실제 WebGL 성능, 보조기술 조합, 대규모 그래프를 증명하지 않습니다.", recovery:"변환 실패 시 마지막 안정 camera, selection, DOM inspector 상태로 되돌립니다.", nextAction:"다음 안전한 단계: 실제 브라우저·보조기술 조합의 동등성 receipt를 연결하세요." }
  }
};

const systemModes = {
  contract: {
    label: "Project contract",
    kicker: "PROJECT / HANDSHAKE",
    state: "FIXTURE",
    title: "kgj.design.json",
    copy: "제품·소유자·표면·DNA·증거 경로를 하나의 이동 가능한 계약으로 고정합니다.",
    metrics: [["Linked paths", "4 / 4"], ["Unresolved", "0"], ["Doctor", "PASS"]],
    trace: [["Inspect", "existing product language"], ["Bind", "portable relative paths"], ["Diagnose", "fail-closed readiness"]]
  },
  evidence: {
    label: "Evidence graph",
    kicker: "EVIDENCE / TYPED GRAPH",
    state: "ILLUSTRATIVE",
    title: "Proof, not prose",
    copy: "주장과 파일을 안정적인 ID·증명 수준·해시·한계·대체 관계로 연결합니다.",
    metrics: [["Fixture records", "8"], ["Dangling refs", "0"], ["Hash drift", "0"]],
    trace: [["Locate", "source or artifact"], ["Classify", "static to browser"], ["Resolve", "active evidence only"]]
  },
  lineage: {
    label: "Lineage lock",
    kicker: "DNA / SEMANTIC CONTRACT",
    state: "FIXTURE",
    title: "Related, never cloned",
    copy: "부모 해시와 허용된 표현 변이를 잠그고 의미 토큰 충돌과 다이아몬드 계보를 거부합니다.",
    metrics: [["Ancestors", "1"], ["Semantic breaks", "0"], ["Token hash", "LOCKED"]],
    trace: [["Resolve", "parent content hashes"], ["Compare", "semantic contract"], ["Lock", "deterministic lineage"]]
  },
  pattern: {
    label: "Pattern lifecycle",
    kicker: "PATTERN / MATURITY",
    state: "CANDIDATE",
    title: "Evidence earns reuse",
    copy: "반복 횟수가 아니라 유용성·고유성·사용성·접근성·일관성·범용성이 패턴의 지위를 결정합니다.",
    metrics: [["Criteria", "6 / 6"], ["Evidence refs", "2"], ["Migration", "REVIEW"]],
    trace: [["Experiment", "one real product flow"], ["Promote", "six criteria pass"], ["Evolve", "deprecate before remove"]]
  }
};

const integerFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const query = new URLSearchParams(window.location.search);
const fixtureMode = query.get("fixture");
const forcedReducedMotion = query.get("motion") === "reduce";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (fixtureMode === "long-ko") {
  phenotypes.operations.decision.title = "결제 지연·재시도 폭증·부분 복구가 동시에 관찰되어 장시간 운영 교대 중인 담당자가 영향 범위와 권한, 롤백 조건을 함께 검토해야 합니다.";
  phenotypes.operations.decision.copy = "서울 리전의 결제 승인, 정산 대기, 재시도 큐, 파트너 응답 지연을 한 번에 비교하고도 식별자 OPS-2026-0144와 복구 책임자가 잘리지 않아야 합니다.";
  phenotypes.research.proof.limitation = "아주 긴 한국어 조사와 괄호 속 근거 식별자, 영문 기술 용어, 12,345건 같은 수량이 함께 있어도 문장 의미와 증거 경계가 잘리거나 겹치지 않아야 하는 스트레스 fixture입니다.";
}
if (fixtureMode === "partial") {
  Object.values(phenotypes).forEach((profile) => {
    profile.proof.verdict = "HOLD — 필수 검증 증거가 일부 누락되었습니다.";
    profile.proof.limitation = "reduced-motion 또는 install readback 영수증이 없어 이 fixture를 release proof로 사용할 수 없습니다.";
    profile.proof.nextAction = "다음 안전한 단계: 누락된 proof level을 실제 실행으로 보완하고 이전 제한 영수증을 명시적으로 supersede하세요.";
    profile.decision.state = "HOLD / PARTIAL PROOF";
  });
}
if (fixtureMode === "error") {
  Object.values(phenotypes).forEach((profile) => {
    profile.proof.verdict = "HOLD — 안전한 복구가 필요한 오류 fixture입니다.";
    profile.proof.postCondition = "변경은 적용되지 않았고 마지막 검증 상태가 유지되었습니다.";
    profile.decision.state = "RECOVERY REQUIRED";
  });
}
if (query.get("textScale") === "200") document.documentElement.dataset.textScale = "200";
if (forcedReducedMotion) document.documentElement.dataset.reducedMotion = "true";

const fixtureBanner = document.querySelector("#test-fixture-banner");
if (fixtureMode || forcedReducedMotion || query.get("textScale")) {
  fixtureBanner.hidden = false;
  fixtureBanner.textContent = `TEST FIXTURE — ${[fixtureMode, forcedReducedMotion ? "reduced-motion" : null, query.get("textScale") ? `text-${query.get("textScale")}%` : null].filter(Boolean).join(" · ")}`;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderBars(metric) {
  const maximum = Math.max(...metric.series.map((item) => item.value));
  [...document.querySelectorAll("#metric-bars .bar-item")].forEach((node, index) => {
    const item = metric.series[index];
    node.querySelector("i").style.setProperty("--value", `${Math.max(8, (item.value / maximum) * 100)}%`);
    node.querySelector("b").textContent = item.label;
    node.querySelector("small").textContent = integerFormatter.format(item.value);
  });
  setText("#chart-summary", metric.summary);
}

function renderProof(profile) {
  setText("#proof-kicker", `PROOF EXPLORER / ${profile.label.toUpperCase()}`);
  setText("#evidence-title", `${profile.label} 근거와 복구`);
  setText("#proof-verdict", profile.proof.verdict);
  setText("#proof-fixture", profile.fixtureId);
  setText("#proof-evidence", profile.proof.evidence);
  setText("#proof-scope", profile.proof.scope);
  setText("#proof-postcondition", profile.proof.postCondition);
  setText("#proof-limitation", profile.proof.limitation);
  setText("#proof-recovery", profile.proof.recovery);
  setText("#proof-next-action", profile.proof.nextAction);
}

function renderPhenotype(mode) {
  const profile = phenotypes[mode];
  if (!profile) return;
  document.documentElement.dataset.phenotype = mode;
  setText("#stage-kicker", profile.kicker);
  setText("#stage-title", profile.title);
  setText("#stage-id", profile.id);
  setText("#primary-label", profile.metric.label);
  setText("#primary-value", integerFormatter.format(profile.metric.value));
  setText("#primary-delta", profile.metric.comparison);
  setText("#decision-state", profile.decision.state);
  setText("#decision-title", profile.decision.title);
  setText("#decision-copy", profile.decision.copy);
  setText("#inspect-button", profile.decision.cta);
  setText("#fixture-state", profile.proof.verdict.startsWith("HOLD") ? "HOLD" : "ILLUSTRATIVE");
  document.querySelector(".primary-card").dataset.fixtureId = profile.fixtureId;
  document.querySelector(".decision-card").dataset.proofState = profile.proof.verdict.startsWith("HOLD") ? "hold" : "illustrative";
  renderBars(profile.metric);
  renderProof(profile);
  ["#trait-density", "#trait-voice", "#trait-motion", "#trait-shape"].forEach((selector, index) => setText(selector, profile.traits[index]));
  restartCanvas();
}

function renderSystem(mode) {
  const item = systemModes[mode];
  if (!item) return;
  setText("#system-kicker", item.kicker);
  setText("#system-state", item.state);
  setText("#system-panel-title", item.title);
  setText("#system-copy", item.copy);
  ["a", "b", "c"].forEach((key, index) => {
    setText(`#system-metric-${key}-label`, item.metrics[index][0]);
    setText(`#system-metric-${key}`, item.metrics[index][1]);
  });
  [...document.querySelectorAll("#system-trace li")].forEach((node, index) => {
    node.querySelector("strong").textContent = item.trace[index][0];
    node.querySelector("small").textContent = item.trace[index][1];
  });
}

function connectTabs({ root, dataKey, panel, status, render, initial }) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function select(value, focus = false, announce = true) {
    const selectedTab = tabs.find((tab) => tab.dataset[dataKey] === value);
    if (!selectedTab) return;
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", selectedTab.id);
    render(value);
    if (focus) selectedTab.focus();
    if (announce) status.textContent = `${selectedTab.textContent.trim()} 보기가 선택되었습니다.`;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab.dataset[dataKey]));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      select(tabs[next].dataset[dataKey], true);
    });
  });
  select(initial, false, false);
  return { select, tabs };
}

let phenotypeController;
let systemController;

const evidenceButton = document.querySelector("#evidence-button");
const evidencePanel = document.querySelector("#evidence-panel");
const evidenceClose = document.querySelector("#evidence-close");
const inspectButton = document.querySelector("#inspect-button");
let returnFocus = null;

function setEvidence(open) {
  [evidenceButton, inspectButton].forEach((button) => button.setAttribute("aria-expanded", String(open)));
  if (open && !evidencePanel.open) {
    returnFocus = document.activeElement;
    evidencePanel.showModal();
    evidenceClose.focus();
  } else if (!open && evidencePanel.open) {
    evidencePanel.close();
  }
}

evidenceButton.addEventListener("click", () => setEvidence(true));
evidenceClose.addEventListener("click", () => setEvidence(false));
evidencePanel.addEventListener("click", (event) => {
  if (event.target === evidencePanel) setEvidence(false);
});
evidencePanel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    setEvidence(false);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...evidencePanel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    evidencePanel.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
});
evidencePanel.addEventListener("close", () => {
  [evidenceButton, inspectButton].forEach((button) => button.setAttribute("aria-expanded", "false"));
  if (returnFocus?.isConnected) returnFocus.focus();
});
evidencePanel.addEventListener("cancel", (event) => {
  event.preventDefault();
  setEvidence(false);
});

inspectButton.addEventListener("click", () => setEvidence(true));

const navToggle = document.querySelector("#nav-toggle");
const primaryNav = document.querySelector("#primary-nav");
function setNavigation(open, restore = false) {
  navToggle.setAttribute("aria-expanded", String(open));
  primaryNav.dataset.open = String(open);
  if (restore) navToggle.focus();
}
navToggle.addEventListener("click", () => setNavigation(navToggle.getAttribute("aria-expanded") !== "true"));
primaryNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setNavigation(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") setNavigation(false, true);
});

const sectionLinks = [...primaryNav.querySelectorAll('a[href^="#"]')];
const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
const sectionObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  sectionLinks.forEach((link) => {
    if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}, { rootMargin: "-25% 0px -60%", threshold: [0, .2, .5] }) : null;
sections.forEach((section) => sectionObserver?.observe(section));

const canvas = document.querySelector("#signal-canvas");
const context = canvas.getContext?.("2d");
let animationFrame = 0;
let startTime = performance.now();
let frameRequests = 0;

function motionIsReduced() {
  return forcedReducedMotion || reducedMotion.matches;
}

function resizeCanvas() {
  if (!context) return;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  context.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawSignal(timestamp) {
  if (!context || document.hidden) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const elapsed = motionIsReduced() ? 0 : (timestamp - startTime) / 1000;
  context.clearRect(0, 0, width, height);
  const style = getComputedStyle(document.documentElement);
  context.strokeStyle = style.getPropertyValue("--stage-accent").trim();
  context.globalAlpha = .22;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = -40; x <= width + 40; x += 8) {
    const y = height * .34 + Math.sin(x * .018 + elapsed * .55) * 24 + Math.sin(x * .007 - elapsed * .22) * 18;
    if (x === -40) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
  context.globalAlpha = 1;
  if (!motionIsReduced()) {
    frameRequests += 1;
    animationFrame = requestAnimationFrame(drawSignal);
  }
}

function restartCanvas() {
  cancelAnimationFrame(animationFrame);
  resizeCanvas();
  startTime = performance.now();
  drawSignal(startTime);
}

window.addEventListener("resize", restartCanvas, { passive: true });
reducedMotion.addEventListener?.("change", restartCanvas);
document.addEventListener("visibilitychange", () => { if (!document.hidden) restartCanvas(); });
phenotypeController = connectTabs({ root: document.querySelector(".phenotype-tabs"), dataKey: "mode", panel: document.querySelector("#phenotype-panel"), status: document.querySelector("#mode-status"), render: renderPhenotype, initial: "operations" });
systemController = connectTabs({ root: document.querySelector(".system-tabs"), dataKey: "system", panel: document.querySelector("#system-panel"), status: document.querySelector("#system-status"), render: renderSystem, initial: "contract" });

window.__kgjDemoDiagnostics = {
  get frameRequests() { return frameRequests; },
  get reducedMotion() { return motionIsReduced(); },
  get phenotypeTabs() { return phenotypeController.tabs.map((tab) => ({ id: tab.id, selected: tab.getAttribute("aria-selected"), tabIndex: tab.tabIndex })); },
  get systemTabs() { return systemController.tabs.map((tab) => ({ id: tab.id, selected: tab.getAttribute("aria-selected"), tabIndex: tab.tabIndex })); },
  get activeFixture() { return document.querySelector(".primary-card").dataset.fixtureId; }
};
