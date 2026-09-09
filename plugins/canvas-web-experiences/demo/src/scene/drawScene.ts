import type { DemoId, DemoState, PointerState } from '../types';

export type DrawEnvironment = {
  id: DemoId;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  state: DemoState;
  pointer: PointerState;
  reducedMotion: boolean;
  model: Record<string, number>;
};

const TAU = Math.PI * 2;
const sceneImageCache = new Map<string, HTMLImageElement>();

function number(state: DemoState, key: string, fallback = 0): number {
  const value = state[key];
  return typeof value === 'number' ? value : fallback;
}

function enabled(state: DemoState, key: string, fallback = false): boolean {
  const value = state[key];
  return typeof value === 'boolean' ? value : fallback;
}

function text(state: DemoState, key: string, fallback = ''): string {
  const value = state[key];
  return typeof value === 'string' ? value : fallback;
}

function rgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const value = Number.parseInt(raw, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clear(ctx: CanvasRenderingContext2D, width: number, height: number, tint = '#0b1116') {
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.45, width * 0.76);
  gradient.addColorStop(0, tint);
  gradient.addColorStop(0.56, '#090e12');
  gradient.addColorStop(1, '#05080b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}

function drawScenePlate(
  ctx: CanvasRenderingContext2D,
  source: string,
  width: number,
  height: number,
  options: { alpha?: number; filter?: string; panX?: number; scale?: number; scaleX?: number; skewX?: number } = {},
): boolean {
  if (typeof Image === 'undefined') return false;
  let image = sceneImageCache.get(source);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.src = source;
    sceneImageCache.set(source, image);
  }
  if (!image.complete || !image.naturalWidth) return false;
  const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight) * (options.scale ?? 1.02);
  const drawWidth = image.naturalWidth * cover;
  const drawHeight = image.naturalHeight * cover;
  const drawX = (width - drawWidth) / 2 + (options.panX ?? 0);
  const drawY = (height - drawHeight) / 2;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.filter = options.filter ?? 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (options.scaleX !== undefined || options.skewX !== undefined) {
    ctx.translate(width / 2, height / 2);
    ctx.transform(options.scaleX ?? 1, 0, options.skewX ?? 0, 1, 0, 0);
    ctx.translate(-width / 2, -height / 2);
  }
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
  return true;
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.4);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.2, rgba(color, alpha * 0.64));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(x, y, radius * 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color = '#b7c3cc', align: CanvasTextAlign = 'left') {
  ctx.font = '500 12px Inter, Pretendard, system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawPortfolio(env: DrawEnvironment) {
  const { ctx, width, height, state, pointer, model } = env;
  clear(ctx, width, height, '#0b1720');
  const density = number(state, 'density', 6);
  const discipline = text(state, 'discipline', '전체');
  const colors = ['#45d6e8', '#ff6b55', '#b48cff', '#63e6be'];
  model.selectedNode ??= 0;
  model.draggingNode ??= -1;
  const nodes = Array.from({ length: 24 }, (_, index) => {
    const ring = index % 4;
    const angle = index * 2.399 + ring * 0.23;
    const radius = Math.min(width, height) * (0.12 + ring * 0.105);
    return {
      // Keep scene geometry deterministic. High-frequency animation belongs to
      // renderer-only glow, not to the semantic HTML hit-target transform.
      x: width / 2 + Math.cos(angle) * radius + (model[`portfolioNode${index}X`] ?? 0),
      y: height / 2 + Math.sin(angle) * radius * 0.64 + (model[`portfolioNode${index}Y`] ?? 0),
      color: colors[index % colors.length],
      category: ['제품', '공간', '브랜드', '제품'][index % 4],
    };
  });
  ctx.lineWidth = 1;
  nodes.forEach((node, index) => {
    for (let offset = 1; offset <= Math.ceil(density / 3); offset += 1) {
      const target = nodes[(index + offset * 5) % nodes.length];
      ctx.strokeStyle = rgba(node.color, 0.11);
      ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    }
  });
  let closest = -1;
  let closestDistance = 72;
  let selected = Math.floor(model.selectedNode ?? 0);
  if (pointer.pressed) {
    const hit = nodes.findIndex((node) => Math.hypot(pointer.pressX - node.x, pointer.pressY - node.y) < 34);
    if (hit >= 0) {
      model.selectedNode = hit;
      model.draggingNode = hit;
      selected = hit;
    }
  }
  const dragging = Math.floor(model.draggingNode ?? -1);
  if (pointer.down && dragging >= 0 && nodes[dragging]) {
    model[`portfolioNode${dragging}X`] = (model[`portfolioNode${dragging}X`] ?? 0) + pointer.dragX;
    model[`portfolioNode${dragging}Y`] = (model[`portfolioNode${dragging}Y`] ?? 0) + pointer.dragY;
    nodes[dragging].x += pointer.dragX;
    nodes[dragging].y += pointer.dragY;
  }
  if (pointer.released) model.draggingNode = -1;
  nodes.forEach((node, index) => {
    const dim = discipline !== '전체' && discipline !== node.category;
    const distance = Math.hypot(pointer.x - node.x, pointer.y - node.y);
    const pressDistance = Math.hypot(pointer.pressX - node.x, pointer.pressY - node.y);
    if (distance < closestDistance) { closest = index; closestDistance = distance; }
    if (pointer.pressed && pressDistance < 34) model.selectedNode = index;
    const active = index === selected || index === closest;
    glowDot(ctx, node.x, node.y, active ? 6 : 3, node.color, dim ? 0.18 : 0.9);
    if (index === selected) {
      ctx.strokeStyle = node.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(node.x, node.y, 14, 0, TAU); ctx.stroke();
    }
    if (enabled(state, 'labels', true) && (!dim || active) && (index % 3 === 0 || active)) {
      label(ctx, `Project ${String(index + 1).padStart(2, '0')}`, node.x + 10, node.y - 8, dim ? '#58636d' : '#cbd6dd');
    }
  });
  ctx.fillStyle = 'rgba(7,12,16,.76)'; ctx.beginPath(); ctx.roundRect(width / 2 - 92, height / 2 - 34, 184, 68, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(69,214,232,.28)'; ctx.stroke();
  label(ctx, 'CURATED PRACTICE', width / 2, height / 2 - 6, '#45d6e8', 'center');
  ctx.font = '650 19px Inter, Pretendard, sans-serif'; ctx.fillStyle = '#f4f7f8'; ctx.textAlign = 'center'; ctx.fillText('관계로 읽는 작업', width / 2, height / 2 + 21);
  if (selected >= 0 && nodes[selected]) {
    const node = nodes[selected];
    model.surfaceAnchorX = node.x;
    model.surfaceAnchorY = node.y;
    model.surfaceAnchorZ = 0;
    model.surfaceVisible = 1;
    model.surfaceOccluded = 0;
    ctx.fillStyle = 'rgba(5,10,14,.92)'; ctx.strokeStyle = rgba(node.color, .58); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(Math.max(18, width - 238), height - 92, 220, 66, 12); ctx.fill(); ctx.stroke();
    label(ctx, `${node.category.toUpperCase()} / SELECTED`, Math.max(32, width - 222), height - 65, node.color);
    ctx.font = '650 15px Inter, Pretendard, sans-serif'; ctx.fillStyle = '#f4f7f8'; ctx.textAlign = 'left'; ctx.fillText(`Project ${String(selected + 1).padStart(2, '0')}`, Math.max(32, width - 222), height - 42);
  }
}

function easingValue(name: string, t: number): number {
  if (name === 'Expressive') return 1 - Math.pow(1 - t, 4);
  if (name === 'Precise') return t * t * (3 - 2 * t);
  if (name === 'Elastic') return t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  return 1 - Math.pow(1 - t, 3);
}

function drawMotion(env: DrawEnvironment) {
  const { ctx, width, height, time, state, reducedMotion, pointer, model } = env;
  clear(ctx, width, height, '#11101b');
  const margin = Math.max(44, width * 0.09);
  const duration = number(state, 'duration', 680);
  const easing = text(state, 'easing', 'Fluid');
  model.motionHandleX ??= width * .62;
  model.motionHandleY ??= height * .28;
  if (pointer.down) {
    model.motionHandleX = Math.max(margin, Math.min(width - margin, pointer.x));
    model.motionHandleY = Math.max(margin, Math.min(height - margin, pointer.y));
  }
  const bendX = (model.motionHandleX - margin) / Math.max(1, width - margin * 2);
  const bendY = 1 - (model.motionHandleY - margin) / Math.max(1, height - margin * 2);
  model.curveTension = Math.round(bendX * 100);
  model.surfaceAnchorX = model.motionHandleX;
  model.surfaceAnchorY = model.motionHandleY;
  model.surfaceAnchorZ = .24;
  model.surfaceVisible = 1;
  model.surfaceOccluded = 0;
  const curvePoint = (value: number) => {
    const inverse = 1 - value;
    return {
      x: inverse * inverse * margin + 2 * inverse * value * model.motionHandleX + value * value * (width - margin),
      y: inverse * inverse * (height - margin) + 2 * inverse * value * model.motionHandleY + value * value * margin,
    };
  };
  const scrubValue = typeof state.motionScrub === 'number' && Number.isFinite(state.motionScrub)
    ? Math.max(0, Math.min(100, state.motionScrub)) / 100
    : null;
  const progress = scrubValue ?? (reducedMotion ? 0.64 : (time % (duration * 1.65)) / (duration * 1.65));
  const ping = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
  const eased = easingValue(easing, Math.min(1, ping));
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin, height - margin); ctx.lineTo(width - margin, margin); ctx.stroke();
  ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120;
    const point = curvePoint(t);
    if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180,140,255,.34)'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(margin, height - margin); ctx.lineTo(model.motionHandleX, model.motionHandleY); ctx.lineTo(width - margin, margin); ctx.stroke(); ctx.setLineDash([]);
  glowDot(ctx, model.motionHandleX, model.motionHandleY, pointer.down ? 7 : 5, '#b48cff');
  const movingPoint = curvePoint(eased);
  const y = movingPoint.y;
  const x = movingPoint.x;
  if (enabled(state, 'trail', true)) {
    for (let i = 7; i > 0; i -= 1) glowDot(ctx, x - i * 16, y + i * 2, 3, '#b48cff', (8 - i) / 24);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(eased * Math.PI); ctx.fillStyle = '#f6f3ff'; ctx.beginPath(); ctx.roundRect(-24, -24, 48, 48, 13); ctx.fill(); ctx.fillStyle = '#b48cff'; ctx.fillRect(-11, -2, 22, 4); ctx.restore();
  label(ctx, easing.toUpperCase(), margin, margin + 4, '#b48cff');
  label(ctx, `${duration} ms · handle ${Math.round(bendX * 100)} / ${Math.round(bendY * 100)}`, margin, margin + 26);
}

function drawGame(env: DrawEnvironment) {
  const { ctx, width, height, time, state, pointer, model } = env;
  clear(ctx, width, height, '#07161a');
  if (drawScenePlate(ctx, '/assets/signal-runner-scene-plate.png', width, height, { alpha: .72, scale: 1.04 })) {
    ctx.fillStyle = 'rgba(2, 8, 12, .2)';
    ctx.fillRect(0, 0, width, height);
  }
  model.playerX ??= width * 0.2;
  model.playerY ??= height * 0.62;
  model.collected ??= Math.max(0, Math.min(63, Math.floor(Number(state.collectedMask ?? (enabled(state, 'gateOpen', false) ? 63 : 0)))));
  model.escaped ??= enabled(state, 'gameEscaped', false) ? 1 : 0;
  if (enabled(state, 'gateOpen', false) && model.collected < 63) model.collected = 63;
  if (enabled(state, 'gameEscaped', false)) model.escaped = 1;
  model.startedAt ??= time;
  model.elapsedSeconds = Math.max(0, (time - model.startedAt) / 1000);
  const speed = number(state, 'speed', 6);
  const targetX = pointer.down ? pointer.x : model.playerX;
  const targetY = pointer.down ? pointer.y : model.playerY;
  const follow = pointer.down ? Math.min(1, .18 * speed) : .035 * speed;
  model.playerX += (targetX - model.playerX) * follow;
  model.playerY += (targetY - model.playerY) * follow;
  const nodes = Array.from({ length: 6 }, (_, i) => ({
    x: width * (0.18 + ((i * 37) % 72) / 100),
    y: height * (0.18 + ((i * 29) % 66) / 100),
  }));
  ctx.setLineDash([4, 9]); ctx.strokeStyle = 'rgba(99,230,190,.2)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(model.playerX, model.playerY); nodes.forEach((node) => ctx.lineTo(node.x, node.y)); ctx.stroke(); ctx.setLineDash([]);
  const pulse = 1 + Math.sin(time * 0.004) * 0.15;
  nodes.forEach((node, i) => {
    const got = (model.collected & (1 << i)) !== 0;
    if (!got && Math.hypot(node.x - model.playerX, node.y - model.playerY) < 34) model.collected |= 1 << i;
    if (!got) { glowDot(ctx, node.x, node.y, 5 * pulse, '#45d6e8'); label(ctx, String(i + 1), node.x, node.y + 4, '#041013', 'center'); }
  });
  const hazards = [[.42,.48],[.67,.34],[.76,.7]];
  hazards.forEach(([hx, hy], index) => {
    const x = width * hx; const y = height * hy; ctx.save(); ctx.translate(x, y); ctx.rotate(time * 0.0006 * (index % 2 ? -1 : 1));
    ctx.strokeStyle = '#ff6b55'; ctx.lineWidth = 2; ctx.beginPath(); for (let p = 0; p < 8; p += 1) { const r = p % 2 ? 11 : 24; const a = p * TAU / 8; if (p === 0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r); else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } ctx.closePath(); ctx.stroke(); ctx.restore();
  });
  const complete = model.collected === 63;
  const gateOpen = complete && enabled(state, 'gateOpen', false);
  const gateX = width * .88; const gateY = height * .2;
  ctx.strokeStyle = gateOpen ? '#63e6be' : complete ? '#ffca6e' : 'rgba(99,230,190,.24)'; ctx.lineWidth = gateOpen ? 8 : 5; ctx.beginPath(); ctx.arc(gateX, gateY, gateOpen ? 52 : 32, 0, TAU); ctx.stroke();
  model.exitUnlocked = gateOpen ? 1 : 0;
  if (gateOpen && Math.hypot(gateX - model.playerX, gateY - model.playerY) < 58) model.escaped = 1;
  model.surfaceAnchorX = gateX;
  model.surfaceAnchorY = gateY;
  model.surfaceAnchorZ = .4;
  model.surfaceVisible = 1;
  // The terminal is the mission's authoritative control surface and remains
  // reachable while the player travels; distance is not visual occlusion.
  model.surfaceOccluded = 0;
  ctx.save(); ctx.translate(model.playerX, model.playerY); ctx.rotate(time * .001); ctx.fillStyle = '#45d6e8'; ctx.beginPath(); for (let p=0;p<8;p+=1){const r=p%2?10:24; const a=p*TAU/8; if(p===0)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r); else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);} ctx.closePath(); ctx.fill(); ctx.fillStyle='#eaffff'; ctx.beginPath();ctx.arc(0,0,7,0,TAU);ctx.fill();ctx.restore();
  label(ctx, `SIGNALS ${model.collected.toString(2).split('1').length - 1} / 6`, 24, 32, '#63e6be');
  if (enabled(state, 'assist', true)) label(ctx, model.escaped ? 'MISSION COMPLETE · 출구 통과' : gateOpen ? '인증 완료 · 게이트로 이동' : complete ? '터미널에서 호출명을 인증하세요' : '드래그 또는 방향키로 이동', 24, height - 24, '#9fb0b9');
}

function drawSpatial(env: DrawEnvironment) {
  const { ctx, width, height, state, pointer, model } = env;
  clear(ctx, width, height, '#080d17');
  model.orbit ??= 0;
  model.orbitPitch ??= 0;
  if (pointer.down || pointer.released) {
    model.orbit += (pointer.dragX || 0) * .0045;
    model.orbitPitch = Math.max(-1.45, Math.min(1.45, model.orbitPitch + (pointer.dragY || 0) * .0045));
  }
  const depth = number(state, 'depth', 10);
  const perspective = number(state, 'perspective', 42);
  model.fov = perspective;
  const horizon = height * .42;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(110,168,255,.13)';
  for (let index = 0; index < 10; index += 1) {
    const x = index * width / 9;
    ctx.beginPath(); ctx.moveTo(x, height); ctx.lineTo(width * .5, horizon); ctx.stroke();
  }
  for (let index = 0; index < depth; index += 1) {
    const t = index / depth;
    const y = horizon + (height - horizon) * Math.pow(t, .72);
    ctx.beginPath(); ctx.moveTo(width * .08 * (1 - t), y); ctx.lineTo(width - width * .08 * (1 - t), y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(180,140,255,.18)';
  ctx.setLineDash([7, 10]);
  ctx.beginPath(); ctx.arc(width * .5, horizon, Math.min(width, height) * .17, Math.PI, 0); ctx.stroke();
  ctx.setLineDash([]);
  model.selectedArtwork ??= 4;
  const selectedArtwork = Math.floor(model.selectedArtwork ?? 4);
  // The visible artwork is owned by the WebGL mesh. Keep the Canvas 2D layer
  // as a stable gallery floor so it cannot create a second fake 3D object.
  model.surfaceAnchorX = width * .52;
  model.surfaceAnchorY = height * .46;
  model.surfaceAnchorZ = enabled(state, 'artworkPinned', false) ? .7 : .5;
  model.surfaceVisible = 1;
  model.surfaceOccluded = 0;
  model.orbitYaw = model.orbit;
  label(ctx, `ARTWORK ${String(selectedArtwork + 1).padStart(2, '0')} · FOV ${perspective}° · YAW ${(model.orbit * 57.3).toFixed(0)}° · PITCH ${(model.orbitPitch * 57.3).toFixed(0)}°`, 24, 32, '#6ea8ff');
}

function drawMap(env: DrawEnvironment) {
  const { ctx, width, height, time, state, pointer, model } = env;
  clear(ctx, width, height, '#071419');
  model.mapX ??= 0; model.mapY ??= 0;
  if(pointer.down){model.mapX += pointer.dragX;model.mapY += pointer.dragY;}
  const zoom=number(state,'zoom',100)/100; const size=54*zoom; const layer=text(state,'layer','이동량');const severity=text(state,'incidentSeverity','delay');
  model.zoom = number(state, 'zoom', 100);
  ctx.save();ctx.translate(width/2+model.mapX,height/2+model.mapY);ctx.rotate(-.16);
  for(let x=-width;x<width;x+=size){for(let y=-height;y<height;y+=size){const ix=Math.round(x/size),iy=Math.round(y/size);const active=(ix*7+iy*11)%5===0;ctx.fillStyle=active?rgba(layer==='녹지'?'#63e6be':layer==='에너지'?'#ffca6e':'#45d6e8',.16):'rgba(255,255,255,.025)';ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.roundRect(x+4,y+4,size-9,size-9,Math.max(2,size*.08));ctx.fill();ctx.stroke();if(active&&enabled(state,'pulse',true)){glowDot(ctx,x+size*.5,y+size*.5,3+Math.sin(time*.004+x)*1.5,'#45d6e8');}}}
  ctx.strokeStyle=severity==='evacuation'?'#ffca6e':severity==='closure'?'#ff6b55':'#45d6e8';ctx.lineWidth=Math.max(2,severity==='evacuation'?8*zoom:5*zoom);ctx.beginPath();ctx.moveTo(-width,40);ctx.bezierCurveTo(-width*.3,-120,width*.2,170,width,20);ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(width/2+model.mapX,height/2+model.mapY);ctx.rotate(-.16);
  ctx.fillStyle='rgba(99,230,190,.12)';ctx.strokeStyle='rgba(99,230,190,.38)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-width*.39,-height*.24,width*.17,height*.16,12);ctx.fill();ctx.stroke();label(ctx,'RIVER PARK',-width*.305,-height*.145,'#63e6be','center');
  ctx.strokeStyle='rgba(110,168,255,.7)';ctx.lineWidth=Math.max(1.5,3*zoom);ctx.beginPath();ctx.moveTo(-width*.46,height*.28);ctx.bezierCurveTo(-width*.2,height*.08,width*.18,height*.36,width*.47,height*.12);ctx.stroke();
  label(ctx,'NORTH COMMON',-width*.26,-height*.3,'#9babb3');label(ctx,'CENTRAL EXCHANGE',width*.04,-height*.12,'#d4dde1');label(ctx,'MAKER DISTRICT',width*.24,height*.27,'#9babb3');ctx.restore();
  ctx.strokeStyle='rgba(255,255,255,.38)';ctx.beginPath();ctx.arc(width/2,height/2,18,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(width/2-27,height/2);ctx.lineTo(width/2+27,height/2);ctx.stroke();ctx.beginPath();ctx.moveTo(width/2,height/2-27);ctx.lineTo(width/2,height/2+27);ctx.stroke();
  const mapPinned=enabled(state,'mapPinned',false);const placeQuery=text(state,'placeQuery','성수');const placeSeed=Array.from(placeQuery).reduce((sum,character)=>sum+character.charCodeAt(0),0);
  const mapAngle=-.16; const geoX=mapPinned?width*(.08+(placeSeed%31)/100):width*.24; const geoY=mapPinned?height*(.08+((placeSeed*7)%25)/100):height*.27; const mapCenterX=width/2+model.mapX; const mapCenterY=height/2+model.mapY;
  model.surfaceAnchorX=mapCenterX+Math.cos(mapAngle)*geoX-Math.sin(mapAngle)*geoY;
  model.surfaceAnchorY=mapCenterY+Math.sin(mapAngle)*geoX+Math.cos(mapAngle)*geoY;
  model.surfaceAnchorZ=zoom;
  model.surfaceVisible=1;
  model.surfaceOccluded=0;
  if(mapPinned){glowDot(ctx,model.surfaceAnchorX,model.surfaceAnchorY,7,'#ffca6e');label(ctx,`${placeQuery||'선택 위치'} · PINNED`,model.surfaceAnchorX+12,model.surfaceAnchorY-12,'#ffca6e');}
  label(ctx, `${layer} · ${severity.toUpperCase()} · ${text(state,'routeLanguage','ko').toUpperCase()} · ${Math.round(zoom*100)}%`,24,32,'#45d6e8');
}

export function diagramLayoutNodes(
  layout: string,
  spacing: number,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  const safeSpacing = Math.max(60, Math.min(180, spacing));
  if (layout === 'Radial') {
    return Array.from({ length: 8 }, (_, index) => {
      const angle = index * TAU / 8;
      return {
        x: width / 2 + Math.cos(angle) * Math.min(width, height) * .31,
        y: height / 2 + Math.sin(angle) * Math.min(width, height) * .28,
      };
    });
  }
  if (layout === 'Stack') {
    return Array.from({ length: 8 }, (_, index) => ({
      x: width / 2 + (index % 2 - .5) * safeSpacing * 1.5,
      y: height * .13 + Math.floor(index / 2) * Math.min(safeSpacing, height * .21),
    }));
  }
  const columnGap = Math.min(width * .72 / 3, safeSpacing * 1.35);
  const rowGap = Math.min(height * .42, Math.max(54, safeSpacing * .85));
  return Array.from({ length: 8 }, (_, index) => ({
    x: width / 2 + (index % 4 - 1.5) * columnGap,
    y: height / 2 + (Math.floor(index / 4) - .5) * rowGap,
  }));
}

export function diagramLayoutSignature(
  layout: string,
  spacing: number,
  layoutEpoch: number,
  width: number,
  height: number,
): number {
  const layoutCode = layout === 'Radial' ? 2 : layout === 'Stack' ? 3 : 1;
  return (
    layoutCode * 1_000_000_000_000 +
    Math.round(spacing) * 1_000_000_000 +
    Math.max(0, Math.floor(layoutEpoch)) * 1_000_000 +
    Math.round(width) * 1_000 +
    Math.round(height)
  );
}

function drawDiagram(env: DrawEnvironment) {
  const {ctx,width,height,time,state,pointer,model}=env; clear(ctx,width,height,'#15130d');
  const spacing=number(state,'spacing',110); const layout=text(state,'layout','Flow');
  const layoutEpoch = Math.max(0, Math.floor(number(state, 'layoutEpoch', 0)));
  const layoutSignature = diagramLayoutSignature(layout, spacing, layoutEpoch, width, height);
  if (model.layoutSignature !== layoutSignature) {
    for (let index = 0; index < 8; index += 1) { delete model[`node${index}X`]; delete model[`node${index}Y`]; }
    model.layoutSignature = layoutSignature;
  }
  const layoutNodes = diagramLayoutNodes(layout, spacing, width, height);
  const nodes = layoutNodes.map((node, index) => ({ x: model[`node${index}X`] ?? node.x, y: model[`node${index}Y`] ?? node.y }));
  model.selectedNode??=4;model.draggingNode??=-1;
  if(pointer.pressed){const hit=nodes.findIndex(n=>Math.hypot(n.x-pointer.pressX,n.y-pointer.pressY)<52);if(hit>=0){model.selectedNode=hit;model.draggingNode=hit;}}
  const selected=Math.floor(model.selectedNode??4);const dragging=Math.floor(model.draggingNode??-1);
  if(dragging>=0&&pointer.down){nodes[dragging].x=pointer.x;nodes[dragging].y=pointer.y;model[`node${dragging}X`]=pointer.x;model[`node${dragging}Y`]=pointer.y;}if(pointer.released)model.draggingNode=-1;
  const contractValid=enabled(state,'nodeHealthy',true)&&text(state,'schemaDraft','PaintReceipt → SurfaceState').includes('→');
  ctx.lineWidth=2;nodes.forEach((node,i)=>{[1,3].forEach(off=>{const target=nodes[(i+off)%nodes.length];ctx.strokeStyle=i===selected&&!contractValid?'rgba(255,107,85,.86)':'rgba(255,202,110,.24)';ctx.setLineDash(i===selected&&!contractValid?[5,7]:[]);ctx.beginPath();ctx.moveTo(node.x,node.y);const mx=(node.x+target.x)/2;ctx.bezierCurveTo(mx,node.y,mx,target.y,target.x,target.y);ctx.stroke();});});ctx.setLineDash([]);
  nodes.forEach((node,i)=>{ctx.fillStyle=i===selected?'#ffca6e':'#101216';ctx.strokeStyle=i%3===0?'#ff6b55':'#ffca6e';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(node.x-42,node.y-24,84,48,12);ctx.fill();ctx.stroke();label(ctx,['Input','Router','Worker','Cache','Canvas','DOM','Audit','Output'][i],node.x,node.y+4,i===selected?'#13100a':'#f0e9da','center');});
  const selectedNode=nodes[selected]??nodes[4];model.surfaceAnchorX=selectedNode.x;model.surfaceAnchorY=selectedNode.y;model.surfaceAnchorZ=0;model.surfaceVisible=1;model.surfaceOccluded=0;
  label(ctx,`${layout.toUpperCase()} · LIVE GRAPH`,24,32,'#ffca6e');glowDot(ctx,width-34,30,3+Math.sin(time*.004), '#63e6be');
}

function drawFloorplan(env: DrawEnvironment) {
  const {ctx,width,height,state,pointer,model}=env;clear(ctx,width,height,'#15100f');
  const grid=number(state,'grid',500);const layer=text(state,'planLayer','구조');const step=Math.max(18,Math.min(58,grid/12));ctx.strokeStyle='rgba(255,107,85,.09)';ctx.lineWidth=1;for(let x=0;x<width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}for(let y=0;y<height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  model.cornerX??=width*.72;model.cornerY??=height*.72;if(pointer.down&&Math.hypot(pointer.x-model.cornerX,pointer.y-model.cornerY)<90){model.cornerX=Math.round(pointer.x/step)*step;model.cornerY=Math.round(pointer.y/step)*step;}
  const x0=width*.16,y0=height*.18,x1=Math.max(x0+150,model.cornerX),y1=Math.max(y0+130,model.cornerY);ctx.strokeStyle='#f4eee9';ctx.lineWidth=8;ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x0+(x1-x0)*.55,y0);ctx.lineTo(x0+(x1-x0)*.55,y1);ctx.moveTo(x0,y0+(y1-y0)*.54);ctx.lineTo(x1,y0+(y1-y0)*.54);ctx.stroke();
  if(layer==='전체'||layer==='구조'){ctx.fillStyle='rgba(255,107,85,.16)';ctx.fillRect(x0+14,y0+14,(x1-x0)*.55-22,(y1-y0)*.54-22);}
  if(layer==='전체'||layer==='가구'){
    ctx.fillStyle='rgba(255,202,110,.18)';ctx.strokeStyle='#ffca6e';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x0+28,y0+30,(x1-x0)*.32,Math.min(54,(y1-y0)*.22),8);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(x0+(x1-x0)*.74,y0+(y1-y0)*.27,Math.min(28,(x1-x0)*.08),0,TAU);ctx.fill();ctx.stroke();
    ctx.strokeRect(x0+(x1-x0)*.62,y0+(y1-y0)*.63,(x1-x0)*.22,(y1-y0)*.19);
  }
  if(layer==='전체'||layer==='동선'){
    ctx.strokeStyle='#63e6be';ctx.lineWidth=8;ctx.lineCap='round';ctx.setLineDash([4,12]);ctx.beginPath();ctx.moveTo(x0+24,y1-30);ctx.bezierCurveTo(x0+(x1-x0)*.28,y1-80,x0+(x1-x0)*.68,y0+80,x1-32,y0+34);ctx.stroke();ctx.setLineDash([]);ctx.lineCap='butt';
  }
  glowDot(ctx,x1,y1,6,'#ff6b55');
  const widthMm=Math.round((x1-x0)*50);const heightMm=Math.round((y1-y0)*50);const baseline=Math.max(1,width*.56*height*.54);model.areaSqm=128*((x1-x0)*(y1-y0))/baseline;model.widthMm=widthMm;model.heightMm=heightMm;
  model.surfaceAnchorX=x1;model.surfaceAnchorY=y1;model.surfaceAnchorZ=0;model.surfaceVisible=1;model.surfaceOccluded=0;
  if(enabled(state,'reviewPinned',false)){ctx.strokeStyle='#63e6be';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x1,y1,16,0,TAU);ctx.stroke();label(ctx,'ISSUE POSTED',x1-10,y1-22,'#63e6be','right');}
  if(enabled(state,'dimensions',true)){ctx.strokeStyle='#ff6b55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y1+26);ctx.lineTo(x1,y1+26);ctx.stroke();label(ctx,`${widthMm.toLocaleString('ko-KR')} mm`,(x0+x1)/2,y1+21,'#ff8c7a','center');ctx.beginPath();ctx.moveTo(x1+26,y0);ctx.lineTo(x1+26,y1);ctx.stroke();ctx.save();ctx.translate(x1+21,(y0+y1)/2);ctx.rotate(-Math.PI/2);label(ctx,`${heightMm.toLocaleString('ko-KR')} mm`,0,0,'#ff8c7a','center');ctx.restore();}
  label(ctx,`${layer} · ${grid.toLocaleString('ko-KR')} mm SNAP`,24,32,'#ff6b55');
}

function drawData(env: DrawEnvironment) {
  const {ctx,width,height,time,state,pointer,model}=env;clear(ctx,width,height,'#071510');
  const margin=52;const chartW=width-margin*2,chartH=height-margin*2;ctx.strokeStyle='rgba(255,255,255,.08)';for(let i=0;i<=5;i+=1){const y=margin+i*chartH/5;ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke();}
  const smoothing=number(state,'smoothing',4);const metric=text(state,'metric','온도');const color=metric==='강수'?'#6ea8ff':metric==='탄소'?'#ffca6e':'#63e6be';ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
  for(let i=0;i<=180;i+=1){const t=i/180;const wave=Math.sin(t*TAU*3)*(.14/smoothing)+Math.sin(t*TAU*11+1)*(.04/smoothing);const trend=t*.55;const y=height-margin-(.18+trend+wave)*chartH;const x=margin+t*chartW;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  if(enabled(state,'compare',true)){ctx.strokeStyle='rgba(255,107,85,.55)';ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(margin,height-margin-chartH*.42);ctx.lineTo(width-margin,height-margin-chartH*.42);ctx.stroke();ctx.setLineDash([]);}
  const stateStart=Math.max(0,Math.min(99,number(state,'brushStartPercent',22)));const stateEnd=Math.max(stateStart+1,Math.min(100,number(state,'brushEndPercent',64)));const brushStateSignature=stateStart*1000+stateEnd;const brushViewportWidth=Math.round(width);const brushViewportHeight=Math.round(height);
  const brushGeometryChanged=model.brushViewportWidth!==brushViewportWidth||model.brushViewportHeight!==brushViewportHeight;
  if((model.brushStateSignature!==brushStateSignature||brushGeometryChanged)&&!pointer.down){model.brushStart=margin+chartW*stateStart/100;model.brushEnd=margin+chartW*stateEnd/100;model.brushStateSignature=brushStateSignature;model.brushViewportWidth=brushViewportWidth;model.brushViewportHeight=brushViewportHeight;}
  model.brushStart??=margin+chartW*.22;model.brushEnd??=margin+chartW*.64;
  if(pointer.pressed&&pointer.x>=margin&&pointer.x<=width-margin){model.brushStart=pointer.x;model.brushEnd=pointer.x;}if(pointer.down){model.brushStart??=pointer.x;model.brushEnd=Math.max(margin,Math.min(width-margin,pointer.x));}
  if(model.brushStart){const a=Math.max(margin,Math.min(model.brushStart,model.brushEnd??model.brushStart));const b=Math.min(width-margin,Math.max(model.brushStart,model.brushEnd??model.brushStart));ctx.fillStyle=rgba(color,.11);ctx.fillRect(a,margin,b-a,chartH);ctx.strokeStyle=color;ctx.strokeRect(a,margin,b-a,chartH);}
  const observationCount=metric==='해수면'?2190:metric==='탄소'?3650:4380;model.selectionPercent=model.brushStart?Math.round(Math.abs((model.brushEnd??model.brushStart)-model.brushStart)/Math.max(1,chartW)*100):0;
  const brushA=Math.max(margin,Math.min(model.brushStart,model.brushEnd??model.brushStart));const brushB=Math.min(width-margin,Math.max(model.brushStart,model.brushEnd??model.brushStart));
  model.brushStartPercent=Math.round((brushA-margin)/Math.max(1,chartW)*100);model.brushEndPercent=Math.round((brushB-margin)/Math.max(1,chartW)*100);model.chartLeft=margin;model.chartRight=width-margin;model.chartTop=margin;model.chartHeight=chartH;
  model.surfaceAnchorX=(brushA+brushB)/2;model.surfaceAnchorY=margin+chartH*.44;model.surfaceAnchorZ=0;model.surfaceVisible=1;model.surfaceOccluded=0;
  label(ctx,`${metric} · ${observationCount.toLocaleString('ko-KR')} OBSERVATIONS`,24,32,color);label(ctx,model.selectionPercent?`선택 구간 ${model.selectionPercent}%`:`LIVE ${Math.sin(time*.001).toFixed(2)}`,width-24,32,'#8fa39a','right');
  label(ctx,'2015',margin,height-18,'#718078');label(ctx,'2020',width/2,height-18,'#718078','center');label(ctx,'2025',width-margin,height-18,'#718078','right');
}

function drawMedia(env: DrawEnvironment) {
  const {ctx,width,height,time,state,pointer,reducedMotion,model}=env;ctx.clearRect(0,0,width,height);ctx.fillStyle='rgba(8,6,14,.64)';ctx.fillRect(0,0,width,height);const distortion=number(state,'distortion',42)/100;const chroma=number(state,'chromatic',8);const running=enabled(state,'playing',true)&&!reducedMotion;const t=running?time*.001:1.8;model.playing=running?1:0;
  model.currentTimeSeconds=Math.floor(number(state,'currentTime',running?(time/1000)%120:42));model.surfaceAnchorX=width*.5;model.surfaceAnchorY=height*.76;model.surfaceAnchorZ=.2;model.surfaceVisible=1;model.surfaceOccluded=0;
  ctx.save();ctx.globalCompositeOperation='screen';
  ['#ff6b55','#45d6e8','#b48cff'].forEach((color,index)=>{ctx.strokeStyle=rgba(color,.72);ctx.lineWidth=3+index;ctx.beginPath();for(let x=-30;x<width+30;x+=5){const nx=x/width;const py=height*.5+Math.sin(nx*TAU*2.2+t+index*.35)*height*.18+Math.sin(nx*TAU*7-t*.7)*height*.055*distortion+(pointer.y-height/2)*.08;const px=x+(index-1)*chroma;if(x===-30)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();});ctx.restore();
  for(let y=0;y<height;y+=4){ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,y,width,1);}
  const gradient=ctx.createLinearGradient(0,0,width,0);gradient.addColorStop(0,'rgba(180,140,255,.02)');gradient.addColorStop(.5,'rgba(69,214,232,.12)');gradient.addColorStop(1,'rgba(255,107,85,.02)');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
  label(ctx,`${running?'PLAYING':'PAUSED'} · CHROMATIC ${chroma}px · DISTORTION ${Math.round(distortion*100)}%`,24,32,'#b48cff');
}

function drawScience(env: DrawEnvironment) {
  const {ctx,width,height,time,state,reducedMotion,model}=env;clear(ctx,width,height,'#0a111d');const gravity=number(state,'gravity',100)/100;const velocity=number(state,'velocity',92)/100;const signature=Math.round(gravity*1000)*10000+Math.round(velocity*1000);if(model.scienceSignature===undefined){model.scienceSignature=signature;model.attempts=Number(state.scienceAttempts??1);}else if(model.scienceSignature!==signature){model.scienceSignature=signature;model.attempts=Number(state.scienceAttempts??(model.attempts??1)+1);}const orbitStep=Math.max(0,Math.floor(number(state,'orbitStep',0)));const t=((reducedMotion?2.2:time*.0005)+orbitStep*.42)*velocity;const cx=width*.5,cy=height*.5;const rx=Math.min(width,height)*(.24+.12/gravity),ry=rx*(.55+velocity*.18);
  ctx.strokeStyle='rgba(110,168,255,.32)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,-.2,0,TAU);ctx.stroke();glowDot(ctx,cx,cy,18,'#ffca6e');
  const px=cx+Math.cos(t)*rx*Math.cos(-.2)-Math.sin(t)*ry*Math.sin(-.2);const py=cy+Math.cos(t)*rx*Math.sin(-.2)+Math.sin(t)*ry*Math.cos(-.2);glowDot(ctx,px,py,7,'#6ea8ff');
  const periapsisX=cx+rx*Math.cos(-.2);const periapsisY=cy+rx*Math.sin(-.2);
  model.surfaceAnchorX=periapsisX;model.surfaceAnchorY=periapsisY;model.surfaceAnchorZ=.3;model.surfaceVisible=1;model.surfaceOccluded=0;
  if(enabled(state,'vectors',true)){ctx.strokeStyle='#ff6b55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+(cx-px)*.28*gravity,py+(cy-py)*.28*gravity);ctx.stroke();ctx.fillStyle='#ff6b55';ctx.beginPath();ctx.arc(px+(cx-px)*.28*gravity,py+(cy-py)*.28*gravity,4,0,TAU);ctx.fill();label(ctx,'gravity',px+(cx-px)*.15,py+(cy-py)*.15-8,'#ff8c7a','center');}
  if(text(state,'orbitHistory','')){ctx.save();ctx.globalAlpha=.32;ctx.setLineDash([5,8]);ctx.strokeStyle='#b48cff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,rx*1.08,ry*.92,-.12,0,TAU);ctx.stroke();ctx.restore();label(ctx,'SAVED FORMULA ORBIT',cx,cy+ry+28,'#b48cff','center');}
  const period=8.2*Math.sqrt(1/gravity)/Math.max(.45,velocity);const eccentricity=Math.min(.98,Math.abs(1-velocity/Math.sqrt(gravity)));label(ctx,`STEP ${orbitStep.toLocaleString('ko-KR')} · G ${gravity.toFixed(2)} · V ${velocity.toFixed(2)} · T ${period.toFixed(1)}s · e ${eccentricity.toFixed(2)}`,24,32,'#6ea8ff');
}

function drawCommerce(env: DrawEnvironment) {
  const { ctx, width, height, state, pointer, model } = env;
  clear(ctx, width, height, '#111318');
  model.productRotation ??= 0;
  model.productPitch ??= 0;
  const dragSensitivity = Math.max(10, Math.min(100, number(state, 'rotation', 42))) / 42;
  if (pointer.down || pointer.released) {
    model.productRotation += pointer.dragX * .012 * dragSensitivity;
    model.productPitch = Math.max(-1.45, Math.min(1.45, model.productPitch + pointer.dragY * .012 * dragSensitivity));
  }
  model.productAngle = ((model.productRotation * 180 / Math.PI) % 360 + 360) % 360;
  // The real product object is owned by WebGL. This layer is only a stable
  // studio floor and never draws a second product image or scaled plate.
  model.surfaceAnchorX=width*.52;model.surfaceAnchorY=height*.46;model.surfaceAnchorZ=1;model.surfaceVisible=1;model.surfaceOccluded=0;
  const material = text(state, 'material', 'Glass');
  const light = number(state, 'light', 100) / 100;
  const cx = width * .5; const floorY = height * .68;
  const studioGlow = ctx.createRadialGradient(cx, floorY, 4, cx, floorY, Math.min(width, height) * .48);
  studioGlow.addColorStop(0, `rgba(255,230,176,${.13 + light * .1})`);
  studioGlow.addColorStop(1, 'rgba(255,107,85,0)');
  ctx.fillStyle = studioGlow; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(69,214,232,.16)'; ctx.lineWidth = 1;
  for (let index = 0; index < 13; index += 1) {
    const angle = Math.PI + index * Math.PI / 12;
    ctx.beginPath(); ctx.moveTo(cx, floorY); ctx.lineTo(cx + Math.cos(angle) * width, floorY + Math.sin(angle) * height); ctx.stroke();
  }
  for (let radius = Math.min(width, height) * .12; radius < Math.max(width, height); radius += Math.min(width, height) * .11) {
    ctx.beginPath(); ctx.ellipse(cx, floorY, radius, radius * .22, 0, Math.PI, 0); ctx.stroke();
  }
  const tint = material === 'Iridescent' ? 'rgba(180,140,255,.1)' : material === 'Frosted' ? 'rgba(224,240,244,.08)' : 'rgba(255,107,85,.035)';
  ctx.fillStyle = tint; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(69,214,232,.45)'; ctx.beginPath(); ctx.moveTo(20, height * .5); ctx.lineTo(width * .28, height * .5); ctx.stroke();
  label(ctx, 'HTML SURFACE', 24, height * .5 - 8, '#45d6e8');
  label(ctx, `${material.toUpperCase()} · YAW ${Math.round(model.productAngle)}° · PITCH ${(model.productPitch * 57.3).toFixed(0)}° · ${Math.round(light * 100)}% LIGHT`, 24, 32, '#ff6b55');
}

function drawTwin(env: DrawEnvironment) {
  const {ctx,width,height,time,state,pointer,model}=env;clear(ctx,width,height,'#16140d');const threshold=number(state,'threshold',72);const live=enabled(state,'live',true);const acknowledged=enabled(state,'acknowledged',false);const zone=text(state,'zone','A동');
  model.selectedEquipment??=3;const nodes=Array.from({length:18},(_,i)=>({x:width*(.12+((i*31)%78)/100),y:height*(.16+((i*47)%70)/100),load:42+((i*23)%51)}));ctx.strokeStyle='rgba(255,202,110,.16)';nodes.forEach((node,i)=>{const next=nodes[(i+5)%nodes.length];ctx.beginPath();ctx.moveTo(node.x,node.y);ctx.lineTo(next.x,next.y);ctx.stroke();});
  if(pointer.pressed){const hit=nodes.findIndex(node=>Math.hypot(pointer.pressX-node.x,pointer.pressY-node.y)<42);if(hit>=0)model.selectedEquipment=hit;}
  const selectedEquipment=Math.floor(model.selectedEquipment??3);model.alarmCount=nodes.filter(node=>node.load>threshold).length;
  nodes.forEach((node,i)=>{const alarm=node.load>threshold&&!acknowledged;const hovered=Math.hypot(pointer.x-node.x,pointer.y-node.y)<26;const selected=i===selectedEquipment;glowDot(ctx,node.x,node.y,selected?8:hovered?6:4,alarm?'#ff6b55':'#63e6be',live?.9:.38);if(selected){const tooltipY=node.y<118?node.y+28:node.y-62;ctx.strokeStyle=alarm?'#ff6b55':'#63e6be';ctx.lineWidth=2;ctx.beginPath();ctx.arc(node.x,node.y,16,0,TAU);ctx.stroke();ctx.fillStyle='rgba(6,9,11,.94)';ctx.beginPath();ctx.roundRect(node.x-68,tooltipY,136,38,8);ctx.fill();ctx.stroke();label(ctx,`AHU-${String(i+1).padStart(2,'0')} · ${node.load}%`,node.x,tooltipY+24,'#f2f5f2','center');}});
  const activeEquipment=nodes[selectedEquipment]??nodes[3];const compact=text(state,'panelLod','detail')==='compact';model.selectedEquipmentLoad=activeEquipment.load;model.surfaceAnchorX=activeEquipment.x;model.surfaceAnchorY=activeEquipment.y;model.surfaceAnchorZ=compact?.28:activeEquipment.load/100;model.surfaceVisible=1;model.surfaceOccluded=enabled(state,'panelOccluded',false)?1:0;model.panelLod=compact?0:1;
  ctx.strokeStyle='#ffca6e';ctx.lineWidth=2;ctx.strokeRect(width*.07,height*.09,width*.86,height*.8);label(ctx,`${zone} DIGITAL TWIN · ${compact?'DISTANT LOD':'DETAIL LOD'} · ${acknowledged?'ACKNOWLEDGED':`${model.alarmCount} ALARMS`} · ${threshold}%`,24,32,'#ffca6e');if(live)glowDot(ctx,width-34,30,3+Math.sin(time*.005),'#63e6be');
}

export function drawScene(environment: DrawEnvironment) {
  const drawById: Record<DemoId, (env: DrawEnvironment) => void> = {
    portfolio: drawPortfolio,
    motion: drawMotion,
    game: drawGame,
    spatial: drawSpatial,
    map: drawMap,
    diagram: drawDiagram,
    floorplan: drawFloorplan,
    data: drawData,
    media: drawMedia,
    science: drawScience,
    commerce: drawCommerce,
    twin: drawTwin,
  };
  drawById[environment.id](environment);
}
