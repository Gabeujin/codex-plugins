import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const plugin=path.join(root,'plugins','k-tech-radar');
const market=JSON.parse(readFileSync(path.join(root,'.agents','plugins','marketplace.json'),'utf8'));
assert.equal(market.name,'gabeujin-plugins');
assert.equal(market.plugins.length,3);
assert.equal(market.plugins[0].source.path,'./plugins/k-tech-radar');
const config=JSON.parse(readFileSync(path.join(plugin,'.mcp.json'),'utf8'));
assert.equal(config.mcpServers['k-tech-radar'].command,'node');
assert.deepEqual(config.mcpServers['k-tech-radar'].args,['./mcp/server.mjs']);
const commands=[
 ['scripts/verify.mjs'],
 ['scripts/scan-secrets.mjs'],
 ['--test','tests/mcp.test.mjs','tests/http.test.mjs','tests/public-http.test.mjs','tests/public-release.test.mjs','tests/release.test.mjs']
];
for(const args of commands){
 const run=spawnSync(process.execPath,args,{cwd:plugin,encoding:'utf8',env:{...process.env,K_TECH_RADAR_DATA_DIR:path.join(plugin,'data'),K_TECH_RADAR_USE_BUNDLED_DATA:'1'},timeout:120000});
 process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');
 if(run.error)throw run.error;
 assert.equal(run.status,0,`Verification failed: node ${args.join(' ')}`);
}
console.log(JSON.stringify({status:'pass',scope:'public-empty-seed-core-and-transport',marketplace:market.name,fullPrivateFixtureSuiteClaimed:false}));
