export const $=(s,r=document)=>r.querySelector(s);
export const $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const mix=(a,b,t)=>a+(b-a)*t;
export const ease=t=>t*t*(3-2*t);
export const TAU=Math.PI*2;
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(n);
export const live=s=>$('#announcement').textContent=s;
export function seeded(seed=3701){return()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};}
export function slider(id,label,min,max,value,step=1,unit=''){
 return `<label class="slider-control" for="${id}"><span>${label}<output id="${id}-out">${fmt(value)}${unit}</output></span><input type="range" name="${id}" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`;
}
export const btn=(id,label,cls='')=>`<button type="button" id="${id}" class="${cls}">${label}</button>`;
export function scope(){
 const ac=new AbortController(),timers=new Set(),cleanups=[];
 return {on(target,event,fn,options={}){(typeof target==='string'?$(target):target)?.addEventListener(event,fn,{...options,signal:ac.signal});},
  later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;},
  clean(fn){cleanups.push(fn);},dispose(){ac.abort();timers.forEach(clearTimeout);cleanups.forEach(fn=>fn());}};
}
export function bindRanges(api,handler){
 $$('input[type=range]',$('#controls')).forEach(input=>api.scope.on(input,'input',()=>{const n=+input.value;const o=$('#'+input.id+'-out');if(o)o.textContent=fmt(n)+(input.dataset.unit||'');api.pause();handler(input.id,n);api.invalidate();}));
}
export function setRange(id,n){const input=$('#'+id);if(input){input.value=n;const o=$('#'+id+'-out');if(o)o.textContent=fmt(n)+(input.dataset.unit||'');}}
export function background(c,w,h,inner,outer){const g=c.createRadialGradient(w*.48,h*.42,10,w*.5,h*.52,Math.max(w,h)*.72);g.addColorStop(0,inner);g.addColorStop(1,outer);c.fillStyle=g;c.fillRect(0,0,w,h);}
export function text(c,txt,x,y,size=12,color='#b9c6b3',font='Consolas'){c.font=`${size}px ${font}`;c.fillStyle=color;c.fillText(txt,x,y);}
export function line(c,points,color,width=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
export function modal(api,title,body){
 api.pause();const trigger=document.activeElement;const d=document.createElement('dialog');d.className='note-dialog';d.setAttribute('aria-label',title);
 d.innerHTML=`<div class="dialog-overline">FIELD NOTES</div><h2>${esc(title)}</h2>${body}<form method="dialog"><button class="solid">작품으로 돌아가기 ↩</button></form>`;document.body.append(d);
 api.scope.on(d,'close',()=>{d.remove();if(trigger?.isConnected)trigger.focus();});api.scope.on(d,'click',e=>{if(e.target===d)d.close();});api.scope.clean(()=>d.remove());d.showModal();
}
export class Stage{
 constructor(canvas){
  this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.time=0;this.playing=false;this.raf=0;this.last=0;this.scene=null;this.disposed=false;this.stats={frames:0,renderDurations:[]};
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.width=1280;this.height=1280*r.height/Math.max(1,r.width);const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.scale=this.canvas.width/1280;this.invalidate();}
 setScene(scene,time){this.scene=scene;this.duration=scene.duration||20;this.time=clamp(time,0,this.duration);this.playing=false;this.last=0;this.invalidate();}
 point(e){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*1280/r.width,y:(e.clientY-r.top)*1280/r.width,mobile:r.width<650};}
 pause(){this.playing=false;this.last=0;this.onChange?.();}
 seek(t){this.pause();this.time=clamp(t,0,this.duration);this.scene?.onTime?.(this.time);this.onChange?.();this.invalidate();}
 invalidate(){if(!this.raf&&!this.disposed)this.raf=requestAnimationFrame(t=>this.frame(t));}
 frame(now){
  // 선택한 작품만 하나의 시계로 그려 숨은 화면의 반복 실행 방지
  this.raf=0;if(this.disposed||!this.scene||!this.c||this.canvas.width<1||this.canvas.height<1)return;
  if(this.playing){if(this.last){this.time=Math.min(this.duration,this.time+Math.max(0,(now-this.last)/1000));if(this.time>=this.duration)this.playing=false;}this.last=now;this.scene.onTime?.(this.time);this.onChange?.();}
  const start=performance.now();this.c.setTransform(this.scale,0,0,this.scale,0,0);this.scene.draw?.(this.c,this.time,this.width,this.height,this.canvas.clientWidth<650);
  this.stats.frames++;this.stats.renderDurations.push(performance.now()-start);if(this.stats.renderDurations.length>2400)this.stats.renderDurations.shift();
  if(this.playing)this.invalidate();
 }
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();}
}
