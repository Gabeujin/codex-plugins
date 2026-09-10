import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {writeFileSync,existsSync,mkdtempSync} from 'node:fs';
import os from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const isolated=mkdtempSync(path.join(os.tmpdir(),'codex-public-verification-'));
const environment={...process.env,KGJ_DESIGN_DATA_DIR:path.join(isolated,'kgj'),K_TECH_RADAR_DATA_DIR:path.join(isolated,'radar'),PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};
const steps=[
 ['common','source',process.execPath,['scripts/verify-public-source.mjs'],'.'],
 ['common','security-and-adapter',process.execPath,['--test','scripts/public-safety.test.mjs','scripts/evidence-adapter.test.mjs'],'.'],
 ['common','artifact-and-rollback','python',['-X','utf8','-B','-m','unittest','discover','-s','scripts','-p','test_*.py','-v'],'.'],
 ['k-tech-radar','public-core-mutation-protocol',process.execPath,['scripts/test-public.mjs'],'plugins/k-tech-radar'],
 ['kgj-design','core-mutation-protocol',process.execPath,['--test','tests/*.test.mjs'],'plugins/kgj-design'],
 ['kgj-design','python-governance','python',['-X','utf8','-B','-m','unittest','discover','-s','tests','-v'],'plugins/kgj-design'],
 ['kgj-design','package','python',['-X','utf8','-B','scripts/kgj_design.py','validate','.'],'plugins/kgj-design'],
 ['canvas-web-experiences','public-package','python',['-X','utf8','-B','scripts/validate_canvas_plugin.py','--public-source'],'plugins/canvas-web-experiences'],
 ['canvas-web-experiences','starter-and-package','python',['-X','utf8','-B','-m','unittest','scripts.test_create_canvas_starter','scripts.test_package_canvas_plugin','-v'],'plugins/canvas-web-experiences'],
];
const results=[];
for(const [plugin,group,command,args,cwd] of steps){
 const run=spawnSync(command,args,{cwd:path.join(root,cwd),encoding:'utf8',env:environment,timeout:180000,windowsHide:true,maxBuffer:10*1024*1024});
 process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
 results.push({plugin,group,status:run.status===0?'passed':'failed',exitCode:run.status,error:run.error?.code??null});
}
results.push({plugin:'canvas-web-experiences',group:'browser-and-demo-build',status:'separate-command',command:'npm ci, npm test, npm run build in demo; browser matrix separately'});
results.push({plugin:'k-tech-radar',group:'live-network',status:'not-run',reason:'Real collection is opt-in; public fixtures require no external service'});
const report={schemaVersion:1,node:process.version,platform:process.platform,status:results.some(x=>x.status==='failed')?'failed':'passed',results};
const i=process.argv.indexOf('--report');if(i>=0){const output=process.argv[i+1];if(existsSync(output))throw new Error('Report exists; choose a new path');writeFileSync(output,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',flag:'wx'});}
console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='passed'?0:1;
