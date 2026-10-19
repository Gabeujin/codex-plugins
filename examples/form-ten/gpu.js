// 복잡한 부재가 서로 가리는 장면은 깊이 버퍼로 처리하고, 실패하면 2D 경로 사용
let gl=null,program=null,canvas=null,buffer=null,loc=null;
const cache=new WeakMap();
function initialize(){
 canvas=document.createElement('canvas');gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});if(!gl)return false;
 const vs=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute float part;attribute float instance;attribute vec3 center;attribute vec3 target;attribute float rank;attribute float rotation;uniform vec4 camera;uniform vec4 screen;uniform float pitch;uniform float centerY;uniform float offsets[7];uniform float lego;uniform float assembly;varying vec3 N;varying vec3 C;varying vec3 P;varying float selectedPart;varying float component;
 void main(){vec3 p=position;p.y+=offsets[int(part)];float u=clamp((lego-rank*.12)/.88,0.,1.);if(assembly>=0.)u=1.-smoothstep(0.,1.,clamp((assembly-rank*.72)/.28,0.,1.));vec3 rel=position-center;float r=rotation*u;vec3 turned=vec3(rel.x,rel.y*cos(r)-rel.z*sin(r),rel.y*sin(r)+rel.z*cos(r));p=mix(p,target+turned,u);float co=cos(camera.x),si=sin(camera.x),cp=cos(pitch),sp=sin(pitch);float x=p.x*co+p.z*si;float z=p.z*co-p.x*si;float y=p.y-centerY;vec2 q=vec2(camera.z+x*camera.y,camera.w+(-y*cp+z*sp)*camera.y);gl_Position=vec4(q.x/screen.x*2.-1.,1.-q.y/screen.y*2.,-(y*sp+z*cp)/3000.,1.);N=vec3(normal.x,normal.y*cos(r)-normal.z*sin(r),normal.y*sin(r)+normal.z*cos(r));C=color;P=p;selectedPart=part;component=instance;}`;
 const fs=`precision highp float;varying vec3 N;varying vec3 C;varying vec3 P;varying float selectedPart;varying float component;uniform vec3 light;uniform vec3 eye;uniform float material;uniform float selected;uniform float selectedInstance;
 void main(){vec3 n=normalize(N);vec3 l=normalize(light);float mat=selectedPart>5.5?material:0.;float diff=max(0.,dot(n,l));float spec=pow(max(0.,dot(n,normalize(l+eye))),mat>0.5?80.:28.);vec3 c=C*(.4+diff*.6);float grain=0.;
 if(mat<.5){c+=spec*.13+grain;}else if(mat<1.5){c=C*(.26+diff*.5)+vec3(spec*.8);c+=pow(1.-abs(dot(n,eye)),4.)*.18;}else{float rim=pow(1.-abs(dot(n,eye)),3.);c=mix(vec3(.64,.75,.73),C,.38)+rim*.2+spec*.4;}
 if((selectedInstance>.5&&abs(component-selectedInstance)<.1)||(selectedInstance<.5&&selected>0.5&&abs(selectedPart-selected)<.1))c=mix(c,vec3(1.,.76,.48),.08);gl_FragColor=vec4(c,mat>1.5?.66:1.);}`;
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return false;}catch{program=null;return false;}
 buffer=gl.createBuffer();loc={};for(const name of ['position','normal','color','part','instance','center','target','rank','rotation'])loc[name]=gl.getAttribLocation(program,name);for(const name of ['camera','screen','pitch','centerY','offsets','light','eye','material','selected','selectedInstance','lego','assembly'])loc[name]=gl.getUniformLocation(program,name);return true;
}
const parts=['all','base','stone','column','frame','roof','body'];
function geometry(mesh){
 let data=cache.get(mesh);if(data)return data;
 const a=[],instances=new Map((mesh.instances||[]).map(v=>[v.id,v])),groups=new Map();
 // 부품의 회전 후 실제 가로·세로 크기로 선반을 채워 정렬 상태의 겹침 방지
 for(const v of mesh.instances||[]){
  const [w,h,d]=v.size;let rotation=0,pw=w,pd=d,ph=h;
  if((v.part==='base'||v.part==='roof')&&w>350&&d>100&&h<150){rotation=-Math.PI/2;pd=h;ph=d;}
  else if(h>Math.max(w,d)*2){rotation=Math.PI/2;pd=h;ph=d;}
  v.legoRotation=rotation;v.legoSize=[pw,ph,pd];if(!groups.has(v.part))groups.set(v.part,[]);groups.get(v.part).push(v);
 }
 const rules={base:{x:-1100,z:-650,width:700},stone:{x:-300,z:-650,width:350},column:{x:150,z:-650,width:540},frame:{x:-1100,z:0,width:700},roof:{x:-200,z:0,width:900}};
 for(const [part,items]of groups){const rule=rules[part]||{x:0,z:0,width:700};let x=0,z=0,row=0;items.sort((a,b)=>b.legoSize[0]*b.legoSize[2]-a.legoSize[0]*a.legoSize[2]);
  items.forEach((v,i)=>{const [w,h,d]=v.legoSize,pad=part==='roof'?9:15;if(x+w+pad>rule.width&&x>0){x=0;z+=row+pad;row=0;}v.legoTarget=[rule.x+x+w/2,h/2+2,rule.z+z+d/2];v.legoRank=({base:0,stone:.16,column:.32,frame:.53,roof:.78}[part]||0)+i/Math.max(1,items.length)*.14;x+=w+pad;row=Math.max(row,d);});
 }
 for(const f of mesh.faces){
  const hex=parseInt(f.color.slice(1),16),color=[16,8,0].map(s=>(hex>>s&255)/255),part=parts.indexOf(f.part),v=instances.get(f.instance),center=v?.center||[0,0,0],target=v?.legoTarget||[0,0,0],rank=v?.legoRank||0,rotation=v?.legoRotation||0;
  for(let i=1;i<f.points.length-1;i++)for(const j of [0,i,i+1])a.push(...f.points[j],...(f.normals?.[j]||f.n),...color,Math.max(0,part),f.instance||0,...center,...target,rank,rotation);
 }
 data=new Float32Array(a);cache.set(mesh,data);return data;
}

export function prepareMesh(mesh){geometry(mesh);}
export function gpuMesh(c,mesh,cam,options){
 if(c.canvas.width<1||c.canvas.height<1)return false;
 if(!loc&&(!initialize()||!loc))return false;
 const w=c.canvas.width,h=c.canvas.height;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 const logicalW=1280,logicalH=h/(w/1280),data=geometry(mesh),offsets=parts.map(p=>options.offsets?.[p]||0),L=options.light||[-.45,.8,.55];
 gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 const stride=76;for(const [name,size,offset]of [['position',3,0],['normal',3,12],['color',3,24],['part',1,36],['instance',1,40],['center',3,44],['target',3,56],['rank',1,68],['rotation',1,72]]){gl.enableVertexAttribArray(loc[name]);gl.vertexAttribPointer(loc[name],size,gl.FLOAT,false,stride,offset);}
 gl.uniform4f(loc.camera,cam.yaw,cam.scale,cam.cx,cam.cy);gl.uniform4f(loc.screen,logicalW,logicalH,0,0);gl.uniform1f(loc.pitch,cam.pitch);gl.uniform1f(loc.centerY,cam.centerY);gl.uniform1fv(loc.offsets,new Float32Array(offsets));gl.uniform3fv(loc.light,L);gl.uniform3fv(loc.eye,[-Math.sin(cam.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),Math.cos(cam.yaw)*Math.cos(cam.pitch)]);gl.uniform1f(loc.material,{metal:1,glass:2}[options.material]||0);gl.uniform1f(loc.selected,Math.max(0,parts.indexOf(options.selected||'all')));
 gl.uniform1f(loc.lego,options.lego||0);gl.uniform1f(loc.assembly,options.assembly??-1);gl.uniform1f(loc.selectedInstance,options.selectedInstance||0);gl.drawArrays(gl.TRIANGLES,0,data.length/19);c.drawImage(canvas,0,0,logicalW,logicalH);return true;
}
