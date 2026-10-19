import {prepareMesh} from './gpu.js';
import {$,$$,TAU,clamp,mix,ease,seeded,slider,btn,bindRanges,setRange,background,text,line,live,modal} from './runtime.js';
import {Mesh,Camera,renderMesh,grid,shadow,shade,pickMesh} from './mesh.js';

const partNames={all:'전체',base:'월대',stone:'초석',column:'기둥',frame:'공포와 보',roof:'기와지붕'};
const palaceMesh=new Mesh();
function addRoof(mesh,upper=false){
 const part='roof',w=upper?213:280,d=upper?145:198,y=upper?316:188,h=upper?66:43,ridge=upper?83:145;
 const shell=mesh.register(`${upper?'상층':'하층'} 지붕 바탕판`,'roof',[0,y+h/2,0],[w*2,h,d*2]);
 const point=(s,q,side)=>[s*(ridge+(w-ridge)*q),y+h*(1-q)**2+9*q**8+10*Math.abs(s)**6*q**3,side*q*d];
 // 처마의 곡률과 기와 골을 별도 면으로 만들어 확대해도 지붕의 리듬 유지
 for(const side of [-1,1]){
  for(let j=0;j<32;j++)for(let k=0;k<9;k++){
   const a=-1+j/16,b=a+1/16,q=k/9,Q=(k+1)/9;
   let p=[point(a,q,side),point(b,q,side),point(b,Q,side),point(a,Q,side)];if(side<0)p.reverse();
   mesh.currentInstance=shell;mesh.face(p,j%2?'#9caeab':'#7f9693',part,{double:true});
  }
  for(let j=0;j<32;j++){const a=point(-1+j/16,1,side),b=point(-1+(j+1)/16,1,side);mesh.currentInstance=mesh.register(`${upper?'상층':'하층'} 처마 마감 ${side>0?'앞':'뒤'} ${j+1}`,'roof',[(a[0]+b[0])/2,(a[1]+b[1])/2-3,side*d],[20,7,4]);mesh.face([a,b,[b[0],b[1]-7,b[2]],[a[0],a[1]-7,a[2]]],'#24463e',part,{double:true});const center=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,side*(d+1)];mesh.cylinder(center[0],center[1],center[2],2,3,'#d1d0b6',part,6);}
 }
 for(const side of [-1,1])for(let j=0;j<12;j++)for(let k=0;k<8;k++){
  const p=(a,q)=>[side*(ridge+(w-ridge)*q),y+h*(1-q)**2+9*q**8+10*Math.abs(a)**6*q**3,a*q*d];const a=-1+j/6,b=a+1/6,q=k/8,Q=(k+1)/8;
  mesh.currentInstance=mesh.register(`${upper?'상층':'하층'} ${side>0?'오른쪽':'왼쪽'} 측면 기와 ${String(j+1).padStart(2,'0')}–${String(k+1).padStart(2,'0')}`,'roof',p((a+b)/2,(q+Q)/2),[16,5,22]);
  for(let r=0;r<5;r++){const A=r/5*Math.PI,B=(r+1)/5*Math.PI,P=(angle,v)=>{const point=p((a+b)/2+Math.cos(angle)*(b-a)*.46,v);point[1]+=Math.sin(angle)*2.4;return point;};const top=[P(A,q+.004),P(B,q+.004),P(B,Q-.004),P(A,Q-.004)],bottom=top.map(v=>[v[0],v[1]-2.5,v[2]]);mesh.face(top,j%2?'#8fa4a0':'#718d85',part,{double:true});mesh.face([...bottom].reverse(),'#536a64',part,{double:true});for(const [a,b]of [[0,1],[2,3]])mesh.face([top[a],top[b],bottom[b],bottom[a]],'#b2b9a6',part,{double:true});}
 }
 // 작은 곡면 기와를 각각 등록해 전체 지붕과 상세 선택이 같은 부품을 가리키도록 구성
 for(const side of [-1,1])for(let j=0;j<32;j++)for(let k=0;k<9;k++){
  const a=-1+(j+.5)/16,q=(k+.5)/9,center=point(a,q,side),name=`${upper?'상층':'하층'} ${side>0?'앞':'뒤'} 기와 ${String(j+1).padStart(2,'0')}–${String(k+1).padStart(2,'0')}`;
  mesh.currentInstance=mesh.register(name,'roof',center,[12,5,20]);
  for(let r=0;r<5;r++){const P=(angle,Q)=>{const v=point(a+Math.cos(angle)*.022,Q,side);v[1]+=Math.sin(angle)*2.5+1;return v;};const A=r/5*Math.PI,B=(r+1)/5*Math.PI;
   const top=[P(A,k/9+.006),P(B,k/9+.006),P(B,(k+1)/9-.006),P(A,(k+1)/9-.006)],bottom=top.map(v=>[v[0],v[1]-2.5,v[2]]);mesh.face(top,j%2?'#9caeab':'#849995',part,{double:true});mesh.face([...bottom].reverse(),'#526a64',part,{double:true});for(const [a,b]of [[0,1],[2,3]])mesh.face([top[a],top[b],bottom[b],bottom[a]],'#b1baa7',part,{double:true});
  }
 }
 mesh.box(0,y+h,0,ridge*2+10,5,9,'#c3cbb6',part);
 for(const sign of [-1,1])for(let j=0;j<5;j++){const p=point(sign*(.72+j*.055),1,1);mesh.cylinder(p[0],p[1]+3,p[2],2.8,5+j%2*2,'#b4c0ab',part,5);}
}
function makePalace(){
 const m=palaceMesh;
 m.box(0,0,0,610,16,460,'#c9c6b0','base').box(0,16,0,570,14,422,'#ddd8be','base').box(0,30,0,520,7,370,'#f0e6c5','base');
 for(const side of [-1,1])for(let i=0;i<9;i++){const x=-267+i*67;m.box(x,30,side*203,6,33,6,'#e0d9bd','base').box(x,61,side*203,10,5,10,'#f1e7c7','base');if(i<8)m.box(x+33,45,side*203,67,5,5,'#e1d7ba','base');}
 for(const side of [-1,1])for(let i=0;i<6;i++){const z=-167+i*67;m.box(side*278,30,z,6,33,6,'#d9d5be','base');if(i<5)m.box(side*278,45,z+33,5,5,67,'#dcd5b7','base');}
 for(let i=0;i<5;i++)m.box(0,i*6,248-i*7,100+i*2,6,15,'#d5cbb0','base');
 for(let layer=0;layer<2;layer++){
  const upper=layer===1,y=upper?216:37,w=upper?310:434,d=upper?207:306,h=upper?60:108;
  for(let i=0;i<6;i++)for(let j=0;j<6;j++)if(i===0||i===5||j===0||j===5){const x=-w/2+i*w/5,z=-d/2+j*d/5;if(!upper)m.box(x,y,z,29,5,29,'#b5b6a2','stone');m.cylinder(x,y+(upper?0:5),z,upper?6.5:8.5,h-(upper?0:5),'#b65e47','column',10,upper?6:7.5);m.box(x,y+h-1,z,21,8,24,'#6a9d7b','frame');}
  for(const z of [-d/2,d/2]){
   m.box(0,y+h+5,z,w+35,12,21,'#3d7668','frame').box(0,y+h+17,z,w+54,5,26,'#d5bb7c','frame').box(0,y+h+22,z,w+69,9,32,'#9e523e','frame');
   for(let x=-w/2;x<=w/2;x+=24){m.box(x,y+h+3,z,12,7,27,'#91af82','frame').box(x,y+h-7,z,8,12,34,'#ad7950','frame').box(x,y+h+12,z+2,6,5,29,'#dbbd87','frame');}
  }
  for(const x of [-w/2,w/2])m.box(x,y+h+5,0,21,12,d+20,'#4b8070','frame').box(x,y+h+17,0,26,5,d+39,'#cbb87b','frame').box(x,y+h+22,0,33,9,d+52,'#9e543f','frame');
  for(let i=0;i<5;i++){const x=-w*.4+i*w*.2;m.box(x,y+14,-d/2+8,w*.17,h-24,4,'#405f50','frame');for(let j=0;j<5;j++)m.box(x-w*.07+j*w*.035,y+15,-d/2+11,1.7,h-25,1.7,'#bcba86','frame');for(let j=0;j<5;j++)m.box(x,y+20+j*(h-30)/5,-d/2+12,w*.16,1.6,1.7,'#b9b487','frame');}
  m.box(0,y+h-12,d/2+13,60,15,3,'#1d3d34','frame');
 }
 m.box(0,205,0,340,11,235,'#456d5a','frame');addRoof(m);addRoof(m,true);return m;
}
makePalace();
const bounds=new Map();for(const f of palaceMesh.faces){if(!bounds.has(f.instance))bounds.set(f.instance,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});const b=bounds.get(f.instance);for(const p of f.points)for(let i=0;i<3;i++){b.min[i]=Math.min(b.min[i],p[i]);b.max[i]=Math.max(b.max[i],p[i]);}}for(const v of palaceMesh.instances){const b=bounds.get(v.id);if(b){v.center=b.min.map((n,i)=>(n+b.max[i])/2);v.size=b.min.map((n,i)=>b.max[i]-n);}}prepareMesh(palaceMesh);
const palaceState={part:'all',explode:0,yaw:-.58,pitch:31,mode:'assembly',building:'근정전',component:0,detail:false,focus:0,tour:true,phase:'전체 구조'};
export function palace(api){
 // 같은 부품 ID를 전체 장면·확대·정렬·목록에서 공유해 선택 대상과 설명의 일치 유지
 const s=palaceState;
 api.controls(`<div class="segmented" role="group" aria-label="건축 보기"><button id="assembly-view" aria-pressed="${s.mode==='assembly'}">부재 해부</button><button id="site-view" aria-pressed="${s.mode==='site'}">축선 보기</button></div><div class="part-picker" role="group" aria-label="근정전 부재">${Object.entries(partNames).map(([id,n])=>`<button data-part="${id}" aria-pressed="${id===s.part}">${n}</button>`).join('')}</div><div class="range-row">${slider('assembly','부재 분리',0,100,s.explode,1,'%')}${slider('palace-yaw','시점 좌우',-80,80,Math.round(s.yaw*180/Math.PI),1,'°')}${slider('palace-pitch','내려다보기',20,55,s.pitch,1,'°')}</div><div class="component-inspector"><label for="component-select">개별 부품 <span id="component-count"></span></label><select id="component-select" aria-label="개별 부품 선택"></select><button id="component-prev" aria-label="이전 부품">←</button><button id="component-next" aria-label="다음 부품">→</button><button id="detail-part" aria-pressed="false">선택 부품 확대</button><button id="whole-building">전체로 복귀</button></div><div id="site-controls" class="site-controls" ${s.mode==='site'?'':'hidden'}>${['근정전','근정문','광화문'].map(n=>`<button data-building="${n}" aria-pressed="${s.building===n}">${n}</button>`).join('')}</div>`);
 api.overlay('<div id="palace-label" class="scene-label"><span class="scene-dot"></span><strong>근정전</strong><small>SCHEMATIC RECONSTRUCTION</small></div><div id="lego-legend" class="lego-legend" hidden>월대 · 초석 · 기둥 · 보·공포 · 기와 — 모형의 개별 부품 정렬</div>');
 const update=()=>{$$('[data-part]').forEach(b=>b.setAttribute('aria-pressed',s.part===b.dataset.part));$$('[data-building]').forEach(b=>b.setAttribute('aria-pressed',s.building===b.dataset.building));$('#assembly-view').setAttribute('aria-pressed',s.mode==='assembly');$('#site-view').setAttribute('aria-pressed',s.mode==='site');$('#site-controls').hidden=s.mode!=='site';$('#detail-part').setAttribute('aria-pressed',String(s.detail));$('#palace-label strong').textContent=s.mode==='site'?s.building:(s.part==='all'?'근정전':partNames[s.part]);api.status(s.mode==='site'?`${s.building} 선택 · 중간 문과 다리를 생략한 축선`:`${partNames[s.part]} · 분리 ${Math.round(s.explode)}% · 설명용 모형`);};
 $$('[data-part]').forEach(b=>api.scope.on(b,'click',()=>{api.pause();s.part=b.dataset.part;s.component=0;s.detail=false;s.focus=0;s.tour=false;s.lego=0;s.assemble=-1;s.layout=0;renderParts();update();api.invalidate();}));$$('[data-building]').forEach(b=>api.scope.on(b,'click',()=>{s.building=b.dataset.building;update();api.invalidate();}));
 api.scope.on('#site-view','click',()=>{s.mode='site';api.pause();update();api.invalidate();});api.scope.on('#assembly-view','click',()=>{s.mode='assembly';update();api.invalidate();});
 bindRanges(api,(id,n)=>{s.tour=false;s.lego=0;s.assemble=-1;s.layout=0;if(id==='assembly')s.explode=n;if(id==='palace-yaw')s.yaw=n*Math.PI/180;if(id==='palace-pitch')s.pitch=n;update();});
 let drag=null,lastCamera=null,lastHeight=0;
 const offsets=()=>{const e=s.explode/100;return {stone:e*18,column:e*76,frame:e*165,roof:e*275};};
 const components=palaceMesh.instances,details=new Map(),fitCache=new Map();
 const renderParts=()=>{const items=components.filter(v=>s.part==='all'||v.part===s.part);$('#component-select').innerHTML=items.map(v=>`<option value="${v.id}">${v.name}</option>`).join('');if(s.component&&items.some(v=>v.id===s.component))$('#component-select').value=s.component;$('#component-count').textContent=`${items.length.toLocaleString('ko-KR')}개 부품`;};
 const selectComponent=()=>{s.component=+$('#component-select').value;s.detail=true;s.focus=1;s.tour=false;api.pause();$('#detail-part').setAttribute('aria-pressed','true');api.invalidate();};
 api.scope.on('#component-select','change',selectComponent);api.scope.on('#detail-part','click',selectComponent);api.scope.on('#whole-building','click',()=>{s.detail=false;s.focus=0;s.component=0;s.tour=false;s.lego=0;s.assemble=-1;s.layout=0;$('#detail-part').setAttribute('aria-pressed','false');update();api.invalidate();});
 api.scope.on('#component-prev','click',()=>{const el=$('#component-select');el.selectedIndex=Math.max(0,el.selectedIndex-1);selectComponent();});api.scope.on('#component-next','click',()=>{const el=$('#component-select');el.selectedIndex=Math.min(el.options.length-1,el.selectedIndex+1);selectComponent();});
 renderParts();
 const drawSite=(c,w,h)=>{
  background(c,w,h,'#183331','#0a191d');const mid=w*.5,base=h*.5;for(let y=base-330;y<base+340;y+=36)line(c,[[180,y],[1100,y]],'#c0cdb61c');for(let x=180;x<1100;x+=36)line(c,[[x,base-330],[x,base+330]],'#c0cdb61c');line(c,[[mid,base-340],[mid,base+340]],'#e2ac6e88');
  const names=['근정전','근정문','광화문'];names.forEach((n,i)=>{const y=base-240+i*235,sel=s.building===n;c.fillStyle=sel?'#d6b27c':'#799b88';c.fillRect(mid-(i?100:165),y-26,i?200:330,i?44:100);c.strokeStyle='#dbe5c5';c.lineWidth=2;c.strokeRect(mid-260,y-70,520,i?120:180);text(c,n,mid+300,y+10,26,sel?'#f5d9a6':'#8fab9f','Noto Lab');});text(c,'N ↑',190,base-330,17);text(c,'AXIS / NOT TO SCALE',190,base+365,14);
 };
 update();
 return {state:s,draw(c,t,w,h,mobile){
  if(s.mode==='site'){drawSite(c,w,h);return;}
  background(c,w,h,'#263e3c','#0d1d23');const camera=new Camera({yaw:s.yaw,pitch:s.pitch*Math.PI/180,scale:mobile?1.3:(1.02-s.explode*.0018),cx:w*.5,cy:h*.49,centerY:205+s.explode*1.9});// 전체 구조의 투영 범위를 먼저 맞춰 회전·분리 중에도 기단과 지붕의 여백 확보
  const probe=new Camera({yaw:camera.yaw,pitch:camera.pitch,scale:1,cx:0,cy:0,centerY:0}),corners=[];
  for(const x of [-305,305])for(const y of [0,390+s.explode*2.75])for(const z of [-265,265])corners.push(probe.project([x,y,z]));
  const loX=Math.min(...corners.map(p=>p.x)),hiX=Math.max(...corners.map(p=>p.x)),loY=Math.min(...corners.map(p=>p.y)),hiY=Math.max(...corners.map(p=>p.y));
  camera.scale=Math.min((w-160)/(hiX-loX),(h-170)/(hiY-loY));camera.centerY=0;camera.cx=w/2-(loX+hiX)/2*camera.scale;camera.cy=h*.49-(loY+hiY)/2*camera.scale;
  const layout=s.layout||0;if(layout>0){const key=s.yaw.toFixed(3)+'-'+h.toFixed(1);let fit=fitCache.get(key);if(!fit){const probe=new Camera({yaw:s.yaw,pitch:.68,scale:1,cx:0,cy:0,centerY:0}),xs=[],ys=[];for(const v of components){const target=v.legoTarget||v.center,size=v.legoSize||v.size;for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=probe.project(target.map((n,i)=>n+[x,y,z][i]*size[i]/2));xs.push(p.x);ys.push(p.y);}}const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min((w-160)/(maxX-minX),(h-160)/(maxY-minY));fit={scale,cx:w/2-(minX+maxX)/2*scale,cy:h/2-(minY+maxY)/2*scale};fitCache.set(key,fit);}camera.scale=mix(camera.scale,fit.scale,layout);camera.centerY=mix(camera.centerY,0,layout);camera.cx=mix(camera.cx,fit.cx,layout);camera.cy=mix(camera.cy,fit.cy,layout);camera.pitch=mix(camera.pitch,.68,layout);camera.cp=Math.cos(camera.pitch);camera.sp=Math.sin(camera.pitch);}$('#lego-legend').hidden=layout<.05;$('#palace-label').hidden=layout>.05;lastCamera=camera;lastHeight=h;grid(c,camera,750,60);shadow(c,camera,0,15,470,130,.48);
  const contextCamera=new Camera({yaw:camera.yaw,pitch:camera.pitch,scale:camera.scale,cx:camera.cx,cy:camera.cy,centerY:camera.centerY});const e=s.explode/100;let chosen=components.find(v=>v.id===s.component);if(s.detail&&chosen){const amount=s.focus??1,targetScale=Math.min(25,450/Math.max(...chosen.size));const origin=contextCamera.project(chosen.center,offsets()[chosen.part]||0),target={x:mix(origin.x,w*.5,amount),y:mix(origin.y,h*.5,amount)};camera.scale=mix(camera.scale,targetScale,amount);camera.centerY=mix(camera.centerY,chosen.center[1]+(offsets()[chosen.part]||0),amount);const p=camera.project(chosen.center,offsets()[chosen.part]||0);camera.cx+=target.x-p.x;camera.cy+=target.y-p.y;}let model=palaceMesh;if(s.detail&&chosen){c.globalAlpha=1-(s.focus??1);renderMesh(c,palaceMesh,contextCamera,{offsets:offsets(),selected:s.part,selectedInstance:s.component});c.globalAlpha=1;if(!details.has(chosen.id))details.set(chosen.id,{faces:palaceMesh.faces.filter(f=>f.instance===chosen.id),lines:[]});model=details.get(chosen.id);const overview=new Camera({yaw:s.yaw,pitch:s.pitch*Math.PI/180,scale:.25,cx:w*.14,cy:h*.23,centerY:170});c.globalAlpha=s.focus??1;renderMesh(c,palaceMesh,overview,{selected:s.part,selectedInstance:s.component});c.globalAlpha=1;}renderMesh(c,model,camera,{offsets:{stone:e*18,column:e*76,frame:e*165,roof:e*275},selected:s.part,selectedInstance:s.component,lego:s.lego||0,assembly:s.assemble??-1});
  if(chosen){const p=camera.project(chosen.center,offsets()[chosen.part]||0);c.strokeStyle='#ffd39b';c.lineWidth=1.3;c.beginPath();c.arc(p.x,p.y,14,0,TAU);c.stroke();$('#palace-label strong').textContent=chosen.name;}
  const anchor=chosen||components.find(v=>v.part===s.part);const p=anchor?camera.project(anchor.center,offsets()[anchor.part]||0):camera.project([217,145,153],e*76);const label=$('#palace-label');if(label){label.style.left=(mobile?5:5)+'%';label.style.top='75%';}
  if(!mobile&&layout<.05){line(c,[[p.x,p.y],[w*.18,h*.76],[w*.08,h*.76]],'#d3c5a270');c.fillStyle='#e6ba7f';c.beginPath();c.arc(p.x,p.y,3,0,TAU);c.fill();}
  text(c,'1395 / GYEONGBOKGUNG',48,h-54,12,'#a7b7a7');text(c,'ARCHITECTURAL INTERPRETATION',48,h-33,9,'#6e8d83');
 },pointerDown(p){drag={x:p.x,y:p.y,yaw:s.yaw,pitch:s.pitch,moved:false};},pointerMove(p){if(drag){if(Math.hypot(p.x-drag.x,p.y-drag.y)>8)drag.moved=true;s.yaw=clamp(drag.yaw+(p.x-drag.x)*.002,-1.4,1.4);s.pitch=clamp(drag.pitch-(p.y-drag.y)*.03,20,55);setRange('palace-yaw',Math.round(s.yaw*180/Math.PI));setRange('palace-pitch',s.pitch);}},pointerUp(p){if(drag&&!drag.moved&&s.mode==='assembly'&&lastCamera&&!s.detail){const id=pickMesh(palaceMesh,lastCamera,p,offsets(),{lego:s.lego||0,assembly:s.assemble??-1}),chosen=components.find(v=>v.id===id);if(chosen){s.component=id;s.part=chosen.part;s.tour=false;renderParts();$('#component-select').value=id;update();api.status(chosen.name+' · 선택 부품 확대로 자세히 볼 수 있습니다.');}}drag=null;},pointerCancel(){if(drag){s.yaw=drag.yaw;s.pitch=drag.pitch;setRange('palace-yaw',Math.round(s.yaw*180/Math.PI));setRange('palace-pitch',s.pitch);}drag=null;},duration:60,components,onPlay(){s.tour=true;},onSeek(){s.tour=true;},onTime(t){
  if(!s.tour)return;s.mode='assembly';s.explode=t<5?ease(t/5)*85:t<48?85:0;s.lego=t<38?0:t<46?ease((t-38)/8):1;s.assemble=t<48?-1:clamp((t-48)/8,0,1);s.layout=t<38?0:t<46?ease((t-38)/8):t<54?1:1-ease(clamp((t-54)/4,0,1));
  const stages=[[5,11,'stone','초석 하나를 관찰합니다'],[14,20,'frame','보와 공포의 부재를 관찰합니다'],[23,29,'roof','두께를 가진 기와 하나를 관찰합니다'],[32,38,'column','기둥의 몸체를 관찰합니다']],part=stages.find(([a,b])=>t>=a&&t<b);
  if(part){const [a,b,k,label]=part;if(s.part!==k){s.part=k;renderParts();}const chosen=components.find(v=>v.part===k&&(k!=='roof'||v.name==='하층 앞 기와 08–05'));s.component=chosen?.id||0;s.detail=true;s.focus=ease(clamp(Math.min((t-a)/2.5,(b-t)/2.5),0,1));s.phase=label;$('#component-select').value=s.component;}
  else{if(s.part!=='all'){s.part='all';renderParts();}s.component=0;s.detail=false;s.focus=0;s.phase=t<5?'부재의 층을 천천히 분리합니다':t<38?'전체 구조를 잠시 바라봅니다':t<46?'작은 부품까지 전부 분해해 종류별로 정렬합니다':t<48?'종류별로 정렬된 모든 모형 부품을 관찰합니다':t<56?'월대부터 아래에서 위로 차곡차곡 조립합니다':'완성된 구조를 감상합니다';}
  setRange('assembly',s.explode);update();api.status(s.phase+' · 설명용 모형 · 60초');
 },reset(){Object.assign(s,{part:'all',explode:0,yaw:-.58,pitch:31,mode:'assembly',building:'근정전',component:0,detail:false,focus:0,tour:true,phase:'전체 구조',lego:0,assemble:-1,layout:0});renderParts();setRange('assembly',0);setRange('palace-yaw',-33);setRange('palace-pitch',31);update();}};
}

const rand=seeded(307),dust=Array.from({length:600},()=>({u:rand(),v:rand(),r:rand()}));
const graphState={nodes:[{id:1,x:240,y:300},{id:2,x:470,y:180},{id:3,x:720,y:260},{id:4,x:1000,y:190},{id:5,x:390,y:540},{id:6,x:760,y:550},{id:7,x:1030,y:490}],edges:[[1,2],[2,3],[3,4],[1,5],[2,5],[3,6],[4,7],[5,6],[6,7]],selected:3,next:8,history:[]};
export function graph(api){
 // 완료한 편집만 이력에 넣고 포인터 취소나 화면 이탈은 시작 전 상태로 복원
 const s=graphState;api.controls(`<div class="button-row">${btn('add-node','＋ 점 만들기')}${btn('connect-node','선 잇기')}${btn('remove-node','선택 점 지우기')}${btn('undo-node','↶ 실행 취소')}<label class="inline-label">연결할 점<select id="edge-target" name="target"></select></label></div><div id="node-list" class="node-strip" role="group" aria-label="점 선택과 키보드 이동"></div>`);api.overlay('<div class="graph-title" aria-hidden="true"><span>RELATIONAL FIELD</span><strong>점.<br><i>선.</i></strong></div>');
 const snapshot=()=>JSON.stringify({nodes:s.nodes,edges:s.edges,selected:s.selected,next:s.next});const restore=str=>Object.assign(s,JSON.parse(str));const remember=str=>{s.history.push(str||snapshot());if(s.history.length>40)s.history.shift();};
 const update=(focus=false)=>{
  $('#node-list').innerHTML=s.nodes.map(n=>`<button data-node="${n.id}" aria-pressed="${s.selected===n.id}" aria-label="점 ${n.id}, 방향키로 이동">${String(n.id).padStart(2,'0')}<span>${Math.round(n.x)}, ${Math.round(n.y)}</span></button>`).join('');$('#edge-target').innerHTML=s.nodes.filter(n=>n.id!==s.selected).map(n=>`<option value="${n.id}">점 ${n.id}</option>`).join('');$('#undo-node').disabled=!s.history.length;$('#remove-node').disabled=s.nodes.length<=1;api.status(`점 ${s.nodes.length}개 · 선 ${s.edges.length}개 · 선택: 점 ${s.selected} · 연결된 점 ${s.edges.filter(e=>e.includes(s.selected)).map(e=>e.find(id=>id!==s.selected)).join(', ')||'없음'} · 방향키로 이동`);if(focus)$(`[data-node="${s.selected}"]`).focus();
 };
 api.scope.on('#add-node','click',()=>{if(s.nodes.length>=24){live('최대 24개까지 만들 수 있습니다. 초기화하거나 기존 점을 편집하세요.');return;}remember();const id=s.next++;s.nodes.push({id,x:240+(id*137)%800,y:150+(id*97)%430});s.selected=id;update(true);api.invalidate();});
 api.scope.on('#connect-node','click',()=>{const target=+$('#edge-target').value;if(!target||s.edges.some(([a,b])=>a===target&&b===s.selected||b===target&&a===s.selected)){live('이미 연결돼 있습니다. 다른 점을 고르세요.');return;}remember();s.edges.push([s.selected,target]);update();api.invalidate();});
 api.scope.on('#remove-node','click',()=>{if(s.nodes.length<=1)return;remember();s.nodes=s.nodes.filter(n=>n.id!==s.selected);s.edges=s.edges.filter(e=>!e.includes(s.selected));s.selected=s.nodes[0].id;update(true);api.invalidate();});
 api.scope.on('#undo-node','click',()=>{if(s.history.length)restore(s.history.pop());update();api.invalidate();});
 api.scope.on('#node-list','click',e=>{const b=e.target.closest('[data-node]');if(b){s.selected=+b.dataset.node;update(true);api.invalidate();}});
 api.scope.on('#node-list','keydown',e=>{if(!e.target.closest('[data-node]')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();api.pause();remember();s.selected=+e.target.closest('[data-node]').dataset.node;const n=s.nodes.find(n=>n.id===s.selected),d=e.shiftKey?30:8;n.x=clamp(n.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),80,1200);n.y=clamp(n.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0),100,650);update(true);api.invalidate();});
 let drag=null,lastH=800,lastMobile=false;update();
 api.scope.clean(()=>{if(drag)restore(drag.before);});
 return {state:s,duration:24,draw(c,t,w,h,mobile){lastH=h;lastMobile=mobile;background(c,w,h,'#172a3b','#07131f');const sy=mobile?2.5:1,oy=mobile?h*.53-380*sy:(h-760)/2;const visual=s.nodes.map(n=>({...n,y:n.y*sy}));for(let x=40;x<w;x+=40)for(let y=45;y<h;y+=40){c.fillStyle='#8cbaac22';c.fillRect(x,y,1.2,1.2);}const map=new Map(visual.map(n=>[n.id,n]));
  for(const [a,b]of s.edges){const A=map.get(a),B=map.get(b);const selected=a===s.selected||b===s.selected;c.strokeStyle=selected?'#f0c395aa':'#74aab960';c.lineWidth=selected?1.6:.85;c.beginPath();c.moveTo(A.x,A.y+oy);c.bezierCurveTo(A.x+(B.x-A.x)*.4,A.y+oy-30,B.x-(B.x-A.x)*.3,B.y+oy+35,B.x,B.y+oy);c.stroke();for(let j=0;j<6;j++){const u=((t/12+j/6)%1),v=1-u,x=v*v*v*A.x+3*v*v*u*(A.x+(B.x-A.x)*.4)+3*v*u*u*(B.x-(B.x-A.x)*.3)+u*u*u*B.x,y=v*v*v*A.y+3*v*v*u*(A.y-30)+3*v*u*u*(B.y+35)+u*u*u*B.y+oy;c.fillStyle=selected?'#f6d6a8':'#8bbfc6';c.fillRect(x-1.3,y-1.3,2.6,2.6);}}
  for(const p of dust){const x=p.u*w,y=p.v*h;let distance=1000;for(const n of visual)distance=Math.min(distance,Math.hypot(n.x-x,n.y+oy-y));if(distance<95){c.fillStyle=`rgba(142,190,189,${(1-distance/95)*.35})`;c.fillRect(x,y,1.5,1.5);}}
  for(const n of visual){const sel=n.id===s.selected;c.strokeStyle=sel?'#f5c38b':'#75a6ad';c.lineWidth=sel?(mobile?4:2):(mobile?2.5:1);c.fillStyle=sel?'#c37851':'#10283a';c.beginPath();c.arc(n.x,n.y+oy,sel?(mobile?54:25):(mobile?40:17),0,TAU);c.fill();c.stroke();if(sel){c.strokeStyle='#f5c38b35';c.beginPath();c.arc(n.x,n.y+oy,mobile?70:34,0,TAU);c.stroke();}c.textAlign='center';text(c,String(n.id).padStart(2,'0'),n.x,n.y+oy+(mobile?10:4),mobile?29:11,sel?'#fff3d8':'#a4c6c0');c.textAlign='left';}
  text(c,'DRAW / CONNECT / UNDO',52,h-39,12,'#91aaa7');
 },pointerDown(p){const y=lastMobile?(p.y-lastH*.53)/2.5+380:p.y-(lastH-760)/2;const n=s.nodes.map(n=>({n,d:Math.hypot(n.x-p.x,(n.y-y)*(lastMobile?2.5:1))})).filter(v=>v.d<(lastMobile?80:42)).sort((a,b)=>a.d-b.d)[0]?.n;if(n){drag={id:n.id,before:snapshot()};s.selected=n.id;update();}},pointerMove(p){if(drag){const n=s.nodes.find(n=>n.id===drag.id);n.x=clamp(p.x,80,1200);n.y=clamp(lastMobile?(p.y-lastH*.53)/2.5+380:p.y-(lastH-760)/2,100,650);}},pointerUp(){if(drag){remember(drag.before);drag=null;update();}},pointerCancel(){if(drag){restore(drag.before);drag=null;update();}},reset(){Object.assign(s,{nodes:[{id:1,x:240,y:300},{id:2,x:470,y:180},{id:3,x:720,y:260},{id:4,x:1000,y:190},{id:5,x:390,y:540},{id:6,x:760,y:550},{id:7,x:1030,y:490}],edges:[[1,2],[2,3],[3,4],[1,5],[2,5],[3,6],[4,7],[5,6],[6,7]],selected:3,next:8,history:[]});update();}};
}

const lightState={x:-45,y:55,depth:75,material:'ceramic',yaw:-.4,fallback:false};
function sculptureMesh(s){
 const m=new Mesh(),keys=[[63,0],[85,7],[96,20],[119,50],[134,95],[128,135],[100,175],[70,212],[57,247],[73,279],[85,285],[82,292],[68,294],[58,283],[47,260],[48,246]];
 const profile=[];for(let i=0;i<keys.length-1;i++){const a=keys[Math.max(0,i-1)],b=keys[i],d=keys[i+1],e=keys[Math.min(keys.length-1,i+2)];for(let j=0;j<6;j++){const t=j/6;profile.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+d[k])*t+(2*a[k]-5*b[k]+4*d[k]-e[k])*t*t+(-a[k]+3*b[k]-3*d[k]+e[k])*t*t*t)));}}profile.push(keys.at(-1));
 const colors={ceramic:'#b7cab0',metal:'#c5bec5',glass:'#9cbbc1'},d=.45+s.depth/100;
 m.box(0,-26,0,360,25,285,'#b9b19f','base').box(0,-30,0,365,4,290,'#c7bfa9','base');
 for(let j=0;j<96;j++)for(let k=0;k<profile.length-1;k++){
  const a=j/96*TAU,b=(j+1)/96*TAU,[r,y]=profile[k],[R,Y]=profile[k+1];const p=(q,r,z)=>[Math.cos(q)*r,z,Math.sin(q)*r*d];
  const points=[p(a,R,Y),p(b,R,Y),p(b,r,y),p(a,r,y)];const normal=(q,index)=>{const before=profile[Math.max(0,index-1)],after=profile[Math.min(profile.length-1,index+1)],dr=after[0]-before[0],dy=after[1]-before[1],n=[dy*Math.cos(q),-dr,dy*Math.sin(q)/d],length=Math.hypot(...n)||1;return n.map(v=>v/length);};const normals=[normal(a,k+1),normal(b,k+1),normal(b,k),normal(a,k)];
  m.face(points,colors[s.material],'body',{normals,alpha:s.material==='glass'?.76:1,double:k>65});
 }
 return m;
}
export function light(api){
 const s=lightState;let mesh=sculptureMesh(s),drag=null;
 api.controls(`<div class="material-picker" role="group" aria-label="재질 선택">${[['ceramic','도자'],['metal','금속'],['glass','유리']].map(([id,n])=>`<button data-material="${id}" aria-pressed="${s.material===id}"><span class="swatch ${id}"></span>${n}</button>`).join('')}</div><div class="range-row">${slider('light-x','광원 X · 오른쪽 +',-100,100,s.x)}${slider('light-y','광원 Y · 위쪽 +',-100,100,s.y)}${slider('object-depth','물체 깊이',20,120,s.depth,1,'%')}</div>${btn('fallback-view','SVG 대체 보기','subtle')}`);
 api.overlay('<div class="material-word" aria-hidden="true"><span>LIGHT / MATTER / VOLUME</span><strong>물성.</strong></div><div id="material-caption" class="material-caption"></div>');
 const update=()=>{$$('[data-material]').forEach(b=>b.setAttribute('aria-pressed',s.material===b.dataset.material));const name={ceramic:'도자',metal:'금속',glass:'유리'}[s.material];$('#material-caption').textContent=name.toUpperCase();$('#fallback-view').textContent=s.fallback?'Canvas로 돌아가기':'SVG 대체 보기';api.status(`${name} · 광원 X ${s.x}, Y ${s.y} · 깊이 ${s.depth}% · 화면 기준`);api.fallback(s.fallback,`<svg viewBox="0 0 500 400" role="img" aria-label="${name} 재질, 광원 X ${s.x}, Y ${s.y}, 깊이 ${s.depth}%"><defs><linearGradient id="fallback-gradient" x1="${50-s.x/2}%" y1="${50+s.y/2}%" x2="${50+s.x/2}%" y2="${50-s.y/2}%"><stop stop-color="#465b4d"/><stop offset="${s.material==='metal'?.48:.75}" stop-color="${s.material==='metal'?'#f1e6d4':'#bdd0ad'}"/><stop offset="1" stop-color="${s.material==='glass'?'#b9e0e2':'#8b9a85'}"/></linearGradient></defs><rect width="500" height="400" fill="#d8d3c6"/><g transform="translate(250 200) scale(${.7+s.depth/200} 1) translate(-250 -200)"><path d="M180 310Q130 250 195 160Q230 120 200 60H300Q270 120 305 160Q370 250 320 310Z" fill="url(#fallback-gradient)" fill-opacity="${s.material==='glass'?.6:1}" stroke="#525d54" stroke-width="3"/></g><ellipse cx="250" cy="310" rx="80" ry="12" fill="#6e766355"/><circle cx="${250+s.x*1.7}" cy="${180-s.y*1.3}" r="10" fill="#cb684c"/></svg>`);};
 $$('[data-material]').forEach(b=>api.scope.on(b,'click',()=>{s.material=b.dataset.material;mesh=sculptureMesh(s);update();api.invalidate();}));
 bindRanges(api,(id,n)=>{if(id==='light-x')s.x=n;if(id==='light-y')s.y=n;if(id==='object-depth'){s.depth=n;mesh=sculptureMesh(s);}update();});api.scope.on('#fallback-view','click',()=>{s.fallback=!s.fallback;$('#fallback-view').textContent=s.fallback?'Canvas로 돌아가기':'SVG 대체 보기';update();});update();
 return {state:s,duration:24,draw(c,t,w,h,mobile){
  background(c,w,h,'#e8e4d7','#c5c2b5');const cam=new Camera({yaw:s.yaw+Math.sin(t/24*TAU)*.12,pitch:.25,scale:mobile?2.25:1.55,cx:w*.54,cy:h*.5,centerY:132});grid(c,cam,600,55,'#526d5418');shadow(c,cam,-s.x*.9,35,290,90,.3);
  const xx=s.x/80,yy=s.y/65,cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),light=[cy*xx+sy*sp*yy-sy*cp*.85,cp*yy+sp*.85,sy*xx-cy*sp*yy+cy*cp*.85];renderMesh(c,mesh,cam,{light,material:s.material==='ceramic'?'matte':s.material});
  const p={x:w*.53+s.x*3,y:h*.25-s.y*1.2};c.fillStyle='#ce7357';c.beginPath();c.arc(p.x,p.y,8,0,TAU);c.fill();c.strokeStyle='#a35b4166';c.setLineDash([3,6]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(w*.54,h*.56);c.stroke();c.setLineDash([]);text(c,'ILLUSTRATIVE MATERIAL / NOT A PHYSICAL SIMULATION',46,h-35,10,'#617060');
 },pointerDown(p){drag={x:p.x,yaw:s.yaw};},pointerMove(p){if(drag)s.yaw=clamp(drag.yaw+(p.x-drag.x)*.003,-1.4,1.4);},pointerUp(){drag=null;},pointerCancel(){if(drag)s.yaw=drag.yaw;drag=null;},reset(){Object.assign(s,{x:-45,y:55,depth:75,material:'ceramic',yaw:-.4,fallback:false});mesh=sculptureMesh(s);setRange('light-x',s.x);setRange('light-y',s.y);setRange('object-depth',s.depth);update();}};
}

const constellationSeed=seeded(984),starPoints=Array.from({length:1600},()=>({u:constellationSeed(),v:constellationSeed(),j:constellationSeed(),r:constellationSeed()}));
const concepts=[['reason','복잡한 추론','REASONING'],['code','코드와 도구','CODING'],['research','자료와 근거','RESEARCH'],['document','문서로 정리','DOCUMENTS']];
const astraState={yaw:0,distance:100,selected:null};
export function astra(api){
 const s=astraState;api.controls(`<div class="range-row">${slider('astra-yaw','공간의 방향',-100,100,s.yaw,1,'°')}${slider('astra-distance','보기 크기',70,130,s.distance,1,'%')}</div><div class="concept-list" role="group" aria-label="개념 선택">${concepts.map(([id,n,en])=>`<button data-concept="${id}"><span>${en}</span>${n} ↗</button>`).join('')}</div>`);
 api.overlay(`<div class="astra-word" aria-hidden="true"><span>GPT—6</span><strong>Astra</strong><i>an atlas of possibilities</i></div><div id="concept-anchors">${concepts.map(([id,n])=>`<button data-anchor="${id}" aria-label="${n} 개념 열기"><span>＋</span><small>${n}</small></button>`).join('')}</div>`);
 const conceptCopy={reason:'조건이 서로 얽힌 질문을 작은 판단으로 나누고, 결론에 필요한 가정을 확인합니다.',code:'수정할 동작을 좁힌 뒤 코드와 도구의 결과를 대조하고 실패 경로까지 점검합니다.',research:'질문에 맞는 원문을 찾고 주장마다 근거와 확인하지 못한 부분을 남깁니다.',document:'독자가 필요한 결론부터 배열하고 근거·조건·다음 행동이 이어지도록 정리합니다.'};
 const open=id=>{s.selected=id;const n=concepts.find(c=>c[0]===id)[1];modal(api,n,`<p>${conceptCopy[id]}</p><p>이 설명은 공식 용도를 바탕으로 작성한 탐색 예시입니다. 모델의 실행 결과나 성능 보증이 아닙니다.</p><p>이 공간과 연결선은 용도를 탐색하기 위한 합성 표현입니다. 실제 모델의 내부 추론이나 호출 결과를 나타내지 않습니다.</p><a href="https://developers.openai.com/api/docs/models/gpt-6-astra" target="_blank" rel="noreferrer">공식 모델 문서 ↗</a>`);};
 $$('[data-concept]').forEach(b=>api.scope.on(b,'click',()=>open(b.dataset.concept)));$$('[data-anchor]').forEach(b=>api.scope.on(b,'click',()=>open(b.dataset.anchor)));bindRanges(api,(id,n)=>{if(id==='astra-yaw')s.yaw=n;else s.distance=n;});
 let drag=null;api.status('개념의 궤도 · 공식 용도를 탐색하는 합성 공간');
 return {state:s,duration:36,draw(c,t,w,h,mobile){
  background(c,w,h,'#122e38','#07151e');const cx=w*.52,cy=h*.51,scale=s.distance/130*Math.min(1.3,(w-160)/(mobile?1485:900),(h-160)/(mobile?1365:650)),angle=s.yaw*Math.PI/180;
  const points=[];for(const p of starPoints){const a=p.u*TAU+t/36*TAU,r=260+Math.sin(p.v*TAU)*62,y=Math.cos(p.v*TAU)*170;let x=Math.cos(a)*r,z=Math.sin(a)*r;const X=x*Math.cos(angle)+z*Math.sin(angle),Z=z*Math.cos(angle)-x*Math.sin(angle);const tilt=-.3;const Y=y*Math.cos(tilt)-Z*Math.sin(tilt),depth=y*Math.sin(tilt)+Z*Math.cos(tilt),pers=700/(700-depth);points.push({x:cx+X*pers*scale*(mobile?1.65:1),y:cy+Y*pers*scale*(mobile?2.1:1),depth,size:(.45+p.r*1.5)*pers,alpha:.2+(depth+360)/1000});}points.sort((a,b)=>a.depth-b.depth);
  for(const p of points){c.fillStyle=`rgba(${p.depth>0?'205,224,187':'94,160,170'},${clamp(p.alpha,.12,.9)})`;c.beginPath();c.arc(p.x,p.y,p.size,0,TAU);c.fill();}
  c.strokeStyle='#8eb5aa55';c.lineWidth=.8;for(let i=0;i<3;i++){c.beginPath();c.ellipse(cx,cy,395*scale,96*scale,-.35+i*.35,0,TAU);c.stroke();}
  const positions=mobile?[[.30,.31],[.20,.62],[.77,.38],[.72,.73]]:[[.27,.23],[.18,.7],[.82,.28],[.78,.77]];
  concepts.forEach(([id],i)=>{const [x,y]=positions[i],el=$(`[data-anchor="${id}"]`);el.style.left=(x*100)+'%';el.style.top=(y*100)+'%';line(c,[[cx,cy],[w*x,h*y]],'#b5c3a12b',.7);});text(c,'CONCEPTUAL SPACE / NO MODEL CALL',48,h-34,10,'#779e9e');
 },pointerDown(p){drag={x:p.x,yaw:s.yaw};},pointerMove(p){if(drag){s.yaw=clamp(drag.yaw+(p.x-drag.x)*.12,-100,100);setRange('astra-yaw',s.yaw);}},pointerUp(){drag=null;},pointerCancel(){if(drag){s.yaw=drag.yaw;setRange('astra-yaw',s.yaw);}drag=null;},reset(){Object.assign(s,{yaw:0,distance:100,selected:null});setRange('astra-yaw',0);setRange('astra-distance',100);}};
}
