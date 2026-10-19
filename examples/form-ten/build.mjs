import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('.', import.meta.url);
const files = [];
async function walk(dir = '') {
  for (const entry of await readdir(new URL(dir, root), {withFileTypes:true})) {
    const name = dir + entry.name;
    if (entry.isDirectory()) await walk(name + '/');
    else if (!['build-id.json'].includes(entry.name)) {
      files.push({path:name, sha256:createHash('sha256').update(await readFile(new URL(name, root))).digest('hex')});
    }
  }
}
await walk();
files.sort((a,b) => a.path.localeCompare(b.path));
const sourceHash = createHash('sha256').update(files.map(x=>`${x.path}\0${x.sha256}\n`).join('')).digest('hex');
await writeFile(new URL('build-id.json',root), JSON.stringify({version:'3.0.0',buildId:sourceHash,sourceHash,buildMode:'Unbundled native ES modules; served source equals executable build',files},null,2));
console.log(sourceHash);
