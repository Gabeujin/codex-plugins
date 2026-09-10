#!/usr/bin/env node
import {existsSync,mkdtempSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const directory=process.argv[2];
if(!directory)throw new Error('Usage: node scripts/test-canvas-browser.mjs PATH_TO_ISOLATED_TOOL_DIRECTORY (see docs/BROWSER-TESTING.md)');
const root=fileURLToPath(new URL('../',import.meta.url)),tools=path.resolve(directory);
const module=path.join(tools,'node_modules','@playwright','test','index.mjs'),cli=path.join(tools,'node_modules','playwright','cli.js');
if(!existsSync(module)||!existsSync(cli))throw new Error('Install isolated @playwright/test@1.58.2 first');
if(JSON.parse(readFileSync(path.join(tools,'node_modules','@playwright','test','package.json'),'utf8')).version!=='1.58.2')throw new Error('Use tested Playwright 1.58.2 or review the runtime policy before upgrading');
const output=mkdtempSync(path.join(os.tmpdir(),'canvas-browser-'));
const run=spawnSync(process.execPath,[cli,'test','--config',path.join(root,'plugins/canvas-web-experiences/demo/playwright.config.mjs'),'--workers=1'],{cwd:root,stdio:'inherit',env:{...process.env,CANVAS_PLAYWRIGHT_TEST_MODULE:module,CANVAS_PLAYWRIGHT_OUTPUT_DIR:path.join(output,'results'),CANVAS_STARTER_OUTPUT_ROOT:path.join(output,'starters')},timeout:300000,windowsHide:true});
console.log(JSON.stringify({schemaVersion:1,scope:'Playwright Chromium/Firefox/WebKit stable fallback; not real Safari or native experimental proof',status:run.status===0?'passed':'failed',retainedArtifacts:output}));
process.exitCode=run.status??1;
