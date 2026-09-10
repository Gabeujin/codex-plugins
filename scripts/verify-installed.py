#!/usr/bin/env python3
"""Read-only exact package-to-install comparison for one plugin."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('manifest',type=Path);p.add_argument('plugin');p.add_argument('installed_root',type=Path);a=p.parse_args()
m=json.loads(a.manifest.read_text(encoding='utf-8'));prefix='plugins/'+a.plugin+'/'
expected={x['path'][len(prefix):]:x for x in m['files'] if x['path'].startswith(prefix)}
if not expected:raise SystemExit('Unknown plugin')
actual={str(f.relative_to(a.installed_root)).replace('\\','/'):f for f in a.installed_root.rglob('*') if f.is_file()}
problems=[str(f.relative_to(a.installed_root)) for f in a.installed_root.rglob('*') if f.is_symlink() or (hasattr(f,'is_junction') and f.is_junction())]
if a.installed_root.is_symlink() or (hasattr(a.installed_root,'is_junction') and a.installed_root.is_junction()):problems.append('<root-link>')
for n,row in expected.items():
 f=actual.get(n)
 if f is None or f.is_symlink() or hashlib.sha256(f.read_bytes()).hexdigest()!=row['sha256']:problems.append(n)
extra=sorted(set(actual)-set(expected))
print(json.dumps({'schemaVersion':1,'plugin':a.plugin,'status':'failed' if problems or extra else 'passed','mismatches':problems,'extraFiles':extra,'expectedFiles':len(expected)}))
raise SystemExit(1 if problems or extra else 0)
