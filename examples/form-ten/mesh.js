import {gpuMesh} from './gpu.js';
import {clamp,TAU} from './runtime.js';
const vector=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=n=>{const m=Math.hypot(...n)||1;return n.map(x=>x/m);};
export function shade(hex,factor){const n=parseInt(hex.slice(1),16);return `rgb(${[16,8,0].map(s=>Math.round(clamp((n>>s&255)*factor,0,255))).join(',')})`;}
export class Mesh{
 constructor(){this.faces=[];this.lines=[];this.instances=[];this.currentInstance=0;this.partCounts=new Map();}
 register(name,part,center,size){const id=this.instances.length+1;this.partCounts.set(part,(this.partCounts.get(part)||0)+1);this.instances.push({id,name,part,center,size});return id;}
 face(points,color,part='all',options={}){const n=normalize(cross(vector(points[1],points[0]),vector(points[2],points[0])));this.faces.push({points,color,part,n,instance:this.currentInstance,...options});return this;}
 line(points,color='#d5dbc080',width=.8,part='all'){this.lines.push({points,color,width,part});return this;}
 box(x,y,z,w,h,d,color,part='all'){
  const names={base:w>400?'월대 기단':h>25?'돌난간 기둥':w>50?'돌난간 가로대':'석재 계단·받침',stone:'초석',column:'기둥',frame:w>200?'수평 보':h>50?'벽·창살 부재':d<5?'창살·현판 부재':h<6?'공포 가로부재':'공포 연결부재',roof:'용마루'};this.currentInstance=this.register((names[part]||'받침')+' '+String((this.partCounts.get(part)||0)+1).padStart(3,'0'),part,[x,y+h/2,z],[w,h,d]);
  const a=x-w/2,b=x+w/2,u=z-d/2,v=z+d/2,Y=y+h,p=[[a,y,u],[b,y,u],[b,y,v],[a,y,v],[a,Y,u],[b,Y,u],[b,Y,v],[a,Y,v]];
  [[4,7,6,5],[0,1,2,3],[3,2,6,7],[0,4,5,1],[0,3,7,4],[1,5,6,2]].forEach(ids=>this.face(ids.map(i=>p[i]),color,part));return this;
 }
 cylinder(x,y,z,r,h,color,part='all',segments=12,topRadius=r){
  this.currentInstance=this.register((part==='column'?'기둥':part==='roof'?'기와 끝장식':'원형 부품')+' '+String((this.partCounts.get(part)||0)+1).padStart(3,'0'),part,[x,y+h/2,z],[r*2,h,r*2]);
  const top=[];for(let i=0;i<segments;i++){const a=i/segments*TAU,b=(i+1)/segments*TAU;const p=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],P=[x+Math.cos(a)*topRadius,y+h,z+Math.sin(a)*topRadius],Q=[x+Math.cos(b)*topRadius,y+h,z+Math.sin(b)*topRadius];this.face([q,p,P,Q],color,part);top.unshift(P);}this.face(top,color,part);return this;
 }
}
export class Camera{
 constructor({yaw=-.55,pitch=.48,scale=1,cx=640,cy=460,centerY=160}={}){Object.assign(this,{yaw,pitch,scale,cx,cy,centerY});this.cos=Math.cos(yaw);this.sin=Math.sin(yaw);this.cp=Math.cos(pitch);this.sp=Math.sin(pitch);}
 project(p,dy=0){const x=p[0]*this.cos+p[2]*this.sin,z=p[2]*this.cos-p[0]*this.sin,y=p[1]+dy-this.centerY;return {x:this.cx+x*this.scale,y:this.cy+(-y*this.cp+z*this.sp)*this.scale,depth:y*this.sp+z*this.cp};}
 facing(n){return n[1]*this.sp+(-n[0]*this.sin+n[2]*this.cos)*this.cp;}
}
export function renderMesh(c,mesh,camera,{offsets={},selected='all',light=[-.45,.8,.55],material='matte',partAlpha=1,selectedInstance=0,lego=0,assembly=-1}={}){
 if(gpuMesh(c,mesh,camera,{offsets,selected,light,material,selectedInstance,lego,assembly}))return [];
 const L=normalize(light),faces=[],instances=new Map((mesh.instances||[]).map(v=>[v.id,v])),baseAlpha=c.globalAlpha;
 // 각 면의 깊이를 정렬해 뒤쪽 부재부터 그리기
 for(const f of mesh.faces){
  const item=instances.get(f.instance),u=partProgress(item,{lego,assembly}),n=turn(f.n,(item?.legoRotation||0)*u);
  if(!f.double&&camera.facing(n)<-.02)continue;
  const p=f.points.map(v=>camera.project(partPoint(v,item,offsets[f.part]||0,u)));const depth=p.reduce((s,v)=>s+v.depth,0)/p.length;
  const diffuse=Math.max(0,n.reduce((s,v,i)=>s+v*L[i],0));let tone=.45+.55*diffuse;
  if(material==='metal')tone=.32+.5*diffuse+Math.pow(Math.max(0,camera.facing(n)),18)*.65;
  if(material==='glass')tone=.68+.35*diffuse;
  faces.push({p,depth,fill:f.unlit?f.color:shade(f.color,tone),selected:selectedInstance?selectedInstance===f.instance:selected!=='all'&&selected===f.part,part:f.part,alpha:f.alpha??partAlpha});
 }
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){c.beginPath();f.p.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.globalAlpha=baseAlpha*f.alpha;c.fillStyle=f.fill;c.fill();c.strokeStyle=f.selected?'#efba7b':'#0c171918';c.lineWidth=f.selected?1.1:.35;c.stroke();}
 c.globalAlpha=baseAlpha;
 for(const l of mesh.lines){const p=l.points.map(v=>camera.project(v,offsets[l.part]||0));c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.strokeStyle=l.color;c.lineWidth=l.width;c.stroke();}
 return faces;
}
export function grid(c,camera,span=650,step=60,color='#b5c9ad14'){
 c.strokeStyle=color;c.lineWidth=.65;for(let n=-span;n<=span;n+=step){for(const a of [[[n,0,-span],[n,0,span]],[[-span,0,n],[span,0,n]]]){const p=a.map(v=>camera.project(v));c.beginPath();c.moveTo(p[0].x,p[0].y);c.lineTo(p[1].x,p[1].y);c.stroke();}}
}
export function shadow(c,camera,x,z,rx,rz,alpha=.32){const p=camera.project([x,0,z]);c.save();c.translate(p.x,p.y);c.scale(rx*camera.scale,rz*camera.scale);const g=c.createRadialGradient(0,0,.1,0,0,1);g.addColorStop(0,`rgba(0,0,0,${alpha})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();}

// GPU를 쓰지 못할 때도 선택과 분해 장면이 같은 부품 위치를 사용하도록 변환 공유
const turn=(v,r)=>[v[0],v[1]*Math.cos(r)-v[2]*Math.sin(r),v[1]*Math.sin(r)+v[2]*Math.cos(r)];
function partProgress(item,options){
 if(!item)return 0;
 if(options.assembly>=0){const a=clamp((options.assembly-(item.legoRank||0)*.72)/.28,0,1);return 1-a*a*(3-2*a);}
 return clamp(((options.lego||0)-(item.legoRank||0)*.12)/.88,0,1);
}
function partPoint(v,item,offset,u){
 const source=[v[0],v[1]+offset,v[2]];if(!item||!u||!item.legoTarget)return source;
 const turned=turn(v.map((n,i)=>n-item.center[i]),(item.legoRotation||0)*u);
 return source.map((n,i)=>n+(item.legoTarget[i]+turned[i]-n)*u);
}

export function pickMesh(mesh,camera,p,offsets={},options={}){
 let best=null,depth=-Infinity;const instances=new Map((mesh.instances||[]).map(v=>[v.id,v]));
 // 투영한 삼각형의 깊이를 보간해 클릭한 위치에서 가장 앞에 있는 실제 부품 선택
 for(const f of mesh.faces){if(!f.instance)continue;const item=instances.get(f.instance);const u=partProgress(item,options),q=f.points.map(v=>camera.project(partPoint(v,item,offsets[f.part]||0,u)));
  for(let i=1;i<q.length-1;i++){const [a,b,d]=[q[0],q[i],q[i+1]],den=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);if(Math.abs(den)<.0001)continue;const u=((b.y-d.y)*(p.x-d.x)+(d.x-b.x)*(p.y-d.y))/den,v=((d.y-a.y)*(p.x-d.x)+(a.x-d.x)*(p.y-d.y))/den;
   if(u>=0&&v>=0&&u+v<=1){const z=u*a.depth+v*b.depth+(1-u-v)*d.depth;if(z>depth){depth=z;best=f.instance;}}
  }
 }return best;
}
