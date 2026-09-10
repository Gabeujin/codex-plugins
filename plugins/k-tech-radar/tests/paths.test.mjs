import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {mkdtemp,writeFile,readFile,mkdir,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {resolveDefaultDataRoot} from '../lib/paths.mjs';
for(const platform of ['win32','darwin','linux']) {
 for(const root of ['/test/.codex/plugins/cache/radar/A','/test/custom-codex/plugins/cache/radar/B','/test/한글 공백/source']) {
  test(`${platform}: data is independent of install ${root}`,()=>{
   const environment={LOCALAPPDATA:'/user/local',XDG_DATA_HOME:'/user/xdg',CODEX_HOME:'/test/custom-codex'};
   const expected=platform==='win32'?join('/user/local','KTechRadar','data'):platform==='darwin'?join('/user','Library','Application Support','KTechRadar','data'):join('/user/xdg','k-tech-radar');
   assert.equal(resolveDefaultDataRoot({platform,root,userHome:'/user',environment}),expected);
   assert.equal(resolveDefaultDataRoot({platform,root,userHome:'/user',environment:{...environment,K_TECH_RADAR_USE_BUNDLED_DATA:'1'}}),join(root,'data'));
   assert.equal(resolveDefaultDataRoot({platform,root,userHome:'/user',environment:{...environment,K_TECH_RADAR_DATA_DIR:'./explicit 한글',K_TECH_RADAR_USE_BUNDLED_DATA:'1'}}),resolve('./explicit 한글'));
  });
 }
}
test('A to B to A cache paths preserve one external sentinel without migration',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'radar-paths-'));
 const environment={LOCALAPPDATA:parent,XDG_DATA_HOME:parent};
 const roots=['A','B','A'].map(v=>join(parent,'custom-codex','plugins','cache',v));
 const data=resolveDefaultDataRoot({environment,userHome:parent,root:roots[0]});
 await mkdir(data,{recursive:true});await writeFile(join(data,'sentinel'),'한글 retained','utf8');
 for(const root of roots){await mkdir(root,{recursive:true});if(process.platform!=='win32')await chmod(root,0o555);assert.equal(await readFile(join(resolveDefaultDataRoot({environment,userHome:parent,root}),'sentinel'),'utf8'),'한글 retained');}
});
